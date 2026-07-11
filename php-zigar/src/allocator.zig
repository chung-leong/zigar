const std = @import("std");
const builtin = @import("builtin");

const ArrayBuffer = @import("js-compat.zig").ArrayBuffer;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const failure = @import("failure.zig");
const getObjectBuffer = @import("object.zig").getObjectBuffer;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const N = php.getStaticString;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const TypeArrays = @import("js-compat.zig").TypeArrays;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const AllocatorStatic = struct {
    methods: Methods = undefined,

    pub fn init(self: *@This(), _: *ZigClassEntry) !void {
        self.methods = .{
            .alloc = php.createTransformedFunction(handleAlloc, "alloc", 1, true),
            .free = php.createTransformedFunction(handleFree, "free", 1, false),
            .dupe = php.createTransformedFunction(handleDupe, "dupe", 1, false),
        };
    }

    pub fn deinit(_: *@This()) void {}

    pub const Methods = struct {
        alloc: Function,
        free: Function,
        dupe: Function,
    };

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        return inline for (std.meta.fields(Methods)) |field| {
            if (php.matchString(name, field.name)) break &@field(self.methods, field.name);
        } else return null;
    }

    pub fn handleAlloc(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 2, "alloc");
        const arg0 = arg_iter.next().?;
        const len = try php.getValueUlong(arg0);
        const alignment_bu = if (arg_iter.next()) |arg1| try php.getValueUlong(arg1) else 1;
        if (!std.math.isPowerOfTwo(alignment_bu)) return error.InvalidAligment;
        const alignment = std.mem.Alignment.fromByteUnits(alignment_bu);
        var allocator = try ExternalAllocator.fromValue(arg_iter.this);
        const buf = try ByteBuffer.create(alignment);
        errdefer buf.release();
        try buf.allocate(&allocator, len);
        defer buf.release();
        const ar_obj = try ArrayBuffer.create(buf);
        _ = buf.externalize();
        return_value.* = php.createValueObject(ar_obj);
    }

    pub fn handleFree(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 1, "free");
        const arg0 = arg_iter.next().?;
        var obj = try php.getValueObject(arg0);
        const buf = get: {
            if (ZigClassEntry.isZig(obj.ce)) {
                const class = ZigClassEntry.fromObject(obj);
                if (class.type == .pointer) {
                    // dereference pointer
                    const ptr_struct = structure.Pointer.fromObject(obj);
                    obj = try ptr_struct.getTarget();
                }
                break :get getObjectBuffer(obj);
            } else if (php.instanceOf(obj, ArrayBuffer.entry())) {
                const ar = ArrayBuffer.fromObject(obj);
                break :get ar.buffer;
            } else inline for (TypeArrays) |TA| {
                if (php.instanceOf(obj, TA.entry())) {
                    const ta = TA.fromObject(obj);
                    break :get ta.buffer;
                }
            } else {
                return error.InvalidOperation;
            }
        };
        if (!buf.inZigMemory()) return error.InvalidOperation;
        if (buf.flags.uninitialized) return error.AccessingDeallocatedMemory;
        var allocator = try ExternalAllocator.fromValue(arg_iter.this);
        switch (buf.source_type) {
            .allocator => {
                if (buf.source.allocator.ptr != allocator.ptr) return error.InvalidOperation;
                buf.free();
            },
            .none => {
                const bytes = try buf.data(0, false);
                allocator.rawFree(@constCast(bytes), buf.alignment, 0);
                buf.free();
            },
            else => return error.InvalidOperation,
        }
    }

    pub fn handleDupe(ed: *ExecuteData, return_value: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        try arg_iter.verifyCount(1, 2, "dupe");
        const arg0 = arg_iter.next().?;
        const bytes, const is_typed_array = get: {
            if (php.getValueString(arg0)) |str| {
                break :get .{ php.getStringContent(str), false };
            } else |_| {
                const obj = try php.getValueObject(arg0);
                if (php.instanceOf(obj, ArrayBuffer.entry())) {
                    const ar = ArrayBuffer.fromObject(obj);
                    break :get .{ try ar.buffer.data(0, false), false };
                } else inline for (TypeArrays) |TA| {
                    if (php.instanceOf(obj, TA.entry())) {
                        const ta = TA.fromObject(obj);
                        break :get .{ try ta.buffer.data(0, false), true };
                    }
                }
            }
            return error.InvalidOperation;
        };
        var allocator = try ExternalAllocator.fromValue(arg_iter.this);
        const buf = try ByteBuffer.create(.@"1");
        try buf.allocate(&allocator, bytes.len);
        defer buf.release();
        try buf.copyBytes(bytes);
        const ar_obj = try ArrayBuffer.create(buf);
        _ = buf.externalize();
        if (is_typed_array) {
            const obj = try php.getValueObject(arg0);
            const new_ta_obj = inline for (TypeArrays) |TA| {
                if (php.instanceOf(obj, TA.entry())) {
                    const ta_obj = try TA.create(buf);
                    const ta_struct = TA.fromObject(ta_obj);
                    ta_struct.array_buffer = ar_obj;
                    break ta_obj;
                }
            } else unreachable;
            return_value.* = php.createValueObject(new_ta_obj);
        } else {
            return_value.* = php.createValueObject(ar_obj);
        }
    }
};

pub const ExternalAllocator = struct {
    const CallContext = struct {};

    pub fn fromValue(value: *Value) !std.mem.Allocator {
        const obj = try php.getValueObject(value);
        return fromObject(obj);
    }

    pub fn fromObject(obj: *Object) std.mem.Allocator {
        const allocator_struct = structure.Struct.fromObject(obj);
        const allocator_class = ZigClassEntry.fromStructure(allocator_struct);
        // call convention is different between debug and release; when there's a mismatch
        // route call to function in the vtable through their thunks
        const debug = builtin.mode == .Debug;
        if (allocator_class.host.module.attributes.debug != debug) {
            return .{
                .ptr = allocator_struct,
                .vtable = &.{
                    .alloc = alloc,
                    .free = free,
                    .remap = remap,
                    .resize = resize,
                },
            };
        } else {
            const allocator_ptr: *std.mem.Allocator = @ptrCast(@alignCast(allocator_struct.buffer.bytes.ptr));
            return allocator_ptr.*;
        }
    }

    fn invoke(context: *anyopaque, comptime name: []const u8, arg_struct: *ArgStruct(name)) !void {
        const allocator_struct: *structure.Struct = @ptrCast(@alignCast(context));
        // set the context pointer
        const ptr = try allocator_struct.getProperty(N("ptr"), null);
        defer php.release(&ptr);
        const ptr_struct = try structure.Pointer.fromValue(&ptr);
        const ptr_address = try ptr_struct.getAddress();
        arg_struct.@"0" = @ptrFromInt(ptr_address);
        // retrieve thunk and function addresses
        const vtable_ptr = try allocator_struct.getProperty(N("vtable"), null);
        defer php.release(&vtable_ptr);
        const vtable_ptr_struct = try structure.Pointer.fromValue(&vtable_ptr);
        const vtable_obj = try vtable_ptr_struct.getTarget();
        const vtable_struct = structure.Struct.fromObject(vtable_obj);
        const alloc_ptr = try vtable_struct.getProperty(N(name), null);
        defer php.release(&alloc_ptr);
        const alloc_ptr_struct = try structure.Pointer.fromValue(&alloc_ptr);
        const alloc_obj = try alloc_ptr_struct.getTarget();
        const alloc_struct = structure.Function.fromObject(alloc_obj);
        const alloc_class = ZigClassEntry.fromObject(alloc_obj);
        const alloc_static = alloc_class.getStaticData(structure.Function);
        const thunk_addr = alloc_static.thunk_address;
        const fn_addr = @intFromPtr(alloc_struct.buffer.bytes.ptr);
        const arg_addr = @intFromPtr(arg_struct);
        const host = alloc_class.host;
        try host.runThunk(thunk_addr, fn_addr, arg_addr);
    }

    fn ArgStruct(comptime name: []const u8) type {
        const Ptr = @FieldType(std.mem.Allocator.VTable, name);
        const Fn = @typeInfo(Ptr).pointer.child;
        return Arg(.normal, Fn);
    }

    fn alloc(context: *anyopaque, len: usize, alignment: std.mem.Alignment, ret_addr: usize) ?[*]u8 {
        var arg_struct: ArgStruct("alloc") = .{
            .retval = undefined,
            .@"0" = undefined,
            .@"1" = len,
            .@"2" = alignment,
            .@"3" = ret_addr,
        };
        invoke(context, "alloc", &arg_struct) catch return null;
        return arg_struct.retval;
    }

    fn resize(context: *anyopaque, memory: []u8, alignment: std.mem.Alignment, new_len: usize, ret_addr: usize) bool {
        var arg_struct: ArgStruct("resize") = .{
            .retval = undefined,
            .@"0" = undefined,
            .@"1" = memory,
            .@"2" = alignment,
            .@"3" = new_len,
            .@"4" = ret_addr,
        };
        invoke(context, "resize", &arg_struct) catch return false;
        return arg_struct.retval;
    }

    fn remap(context: *anyopaque, memory: []u8, alignment: std.mem.Alignment, new_len: usize, ret_addr: usize) ?[*]u8 {
        var arg_struct: ArgStruct("remap") = .{
            .retval = undefined,
            .@"0" = undefined,
            .@"1" = memory,
            .@"2" = alignment,
            .@"3" = new_len,
            .@"4" = ret_addr,
        };
        invoke(context, "remap", &arg_struct) catch return null;
        return arg_struct.retval;
    }

    fn free(context: *anyopaque, old_memory: []u8, alignment: std.mem.Alignment, ret_addr: usize) void {
        var arg_struct: ArgStruct("free") = .{
            .retval = undefined,
            .@"0" = undefined,
            .@"1" = old_memory,
            .@"2" = alignment,
            .@"3" = ret_addr,
        };
        invoke(context, "free", &arg_struct) catch {};
    }
};

pub fn Arg(comptime _: @TypeOf(.enum_literal), comptime T: type) type {
    const f = @typeInfo(T).@"fn";
    const count = get: {
        var count = 1;
        for (f.params) |param| {
            if (param.type != null) {
                count += 1;
            }
        }
        break :get count;
    };
    const RT = if (f.return_type) |RT| switch (RT) {
        noreturn => void,
        else => RT,
    } else void;
    var fields: [count]std.builtin.Type.StructField = undefined;
    fields[0] = .{
        .name = "retval",
        .type = RT,
        .is_comptime = false,
        .alignment = @alignOf(RT),
        .default_value_ptr = null,
    };
    var arg_index = 0;
    for (f.params) |param| {
        if (param.type != null) {
            const name = std.fmt.comptimePrint("{d}", .{arg_index});
            fields[arg_index + 1] = .{
                .name = name,
                .type = param.type.?,
                .is_comptime = false,
                .alignment = @alignOf(param.type.?),
                .default_value_ptr = null,
            };
            arg_index += 1;
        }
    }
    return @Type(.{
        .@"struct" = .{
            .layout = .auto,
            .decls = &.{},
            .fields = &fields,
            .is_tuple = false,
        },
    });
}
