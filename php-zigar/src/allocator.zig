const std = @import("std");
const builtin = @import("builtin");

const ArrayBuffer = @import("js-compat.zig").ArrayBuffer;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const failure = @import("failure.zig");
const getObjectBuffer = @import("object.zig").getObjectBuffer;
const php = @import("php.zig");
const php_ng = @import("php/root.zig");
const c = php_ng.c;
const Function = php_ng.Function;
const Object = php_ng.Object;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;
const structure = @import("structure.zig");
const TypeArrays = @import("js-compat.zig").TypeArrays;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const AllocatorStatic = struct {
    methods: Methods = undefined,

    pub fn init(self: *@This()) !void {
        self.methods = .{
            .alloc = .fromHandler(onAlloc, *Object),
            .free = .fromHandler(onFree, *Object),
            .dupe = .fromHandler(onDupe, *Object),
        };
    }

    pub fn deinit(_: *@This()) void {}

    pub const Methods = struct {
        alloc: Function,
        free: Function,
        dupe: Function,
    };

    pub fn findMethod(self: *@This(), name: *String) ?*php.Function {
        const fn_ng = inline for (comptime std.meta.fieldNames(Methods)) |field_name| {
            if (name.matchSlice(field_name)) break &@field(self.methods, field_name);
        } else return null;
        return @ptrCast(fn_ng);
    }

    pub fn onAlloc(allocator_obj: *Object, args: struct {
        len: usize,
        alignment: usize = 1,
    }) !*Object {
        if (!std.math.isPowerOfTwo(args.alignment)) return error.InvalidAligment;
        const alignment = std.mem.Alignment.fromByteUnits(args.alignment);
        var allocator = ExternalAllocator.fromObject(allocator_obj);
        const buf = try ByteBuffer.create(alignment);
        errdefer buf.release();
        try buf.allocate(&allocator, args.len);
        defer buf.release();
        defer _ = buf.externalize();
        const ab = try ArrayBuffer.create(buf);
        return @ptrCast(ab);
    }

    pub fn onFree(allocator_obj: *Object, args: struct {
        object: *Object,
    }) !void {
        var obj_og: *c.zend_object = @ptrCast(args.object);
        const buf = get: {
            if (ZigClassEntry.isZig(obj_og.ce)) {
                const class = ZigClassEntry.fromObject(obj_og);
                if (class.type == .pointer) {
                    // dereference pointer
                    const ptr_struct = structure.Pointer.fromObject(obj_og);
                    obj_og = try ptr_struct.getTarget();
                }
                break :get getObjectBuffer(obj_og);
            } else if (php.instanceOf(obj_og, ArrayBuffer.entry())) {
                const ar = ArrayBuffer.fromObject(obj_og);
                break :get ar.buffer;
            } else inline for (TypeArrays) |TA| {
                if (php.instanceOf(obj_og, TA.entry())) {
                    const ta = TA.fromObject(obj_og);
                    break :get ta.buffer;
                }
            } else {
                return error.InvalidOperation;
            }
        };
        if (!buf.inZigMemory()) return error.InvalidOperation;
        if (buf.flags.uninitialized) return error.AccessingDeallocatedMemory;
        var allocator = ExternalAllocator.fromObject(allocator_obj);
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
        const allocator_class = ZigClassEntry.fromObject(@ptrCast(allocator_obj));
        allocator_class.host.object_map.free(buf);
    }

    pub fn onDupe(allocator_obj: *Object, args: struct {
        source: union(enum) {
            string: *String,
            object: *Object,
        },
    }) !*Object {
        const bytes, const is_typed_array = switch (args.source) {
            .string => |str| .{ str.slice(), false },
            .object => |obj| get: {
                if (obj.isInstanceOf(@ptrCast(ArrayBuffer.entry()))) {} else inline for (TypeArrays) |TA| {
                    if (obj.isInstanceOf(@ptrCast(TA.entry()))) {
                        const ta = TA.fromObject(@ptrCast(obj));
                        break :get .{ try ta.buffer.data(0, false), true };
                    }
                }
                return error.InvalidOperation;
            },
        };
        var allocator = ExternalAllocator.fromObject(allocator_obj);
        const buf = try ByteBuffer.create(.@"1");
        try buf.allocate(&allocator, bytes.len);
        defer buf.release();
        try buf.copyBytes(bytes);
        const ar_obj = try ArrayBuffer.create(buf);
        _ = buf.externalize();
        if (is_typed_array) {
            const obj = args.source.object;
            const new_ta_obj = inline for (TypeArrays) |TA| {
                if (obj.isInstanceOf(@ptrCast(TA.entry()))) {
                    const ta_obj = try TA.create(buf);
                    const ta_struct = TA.fromObject(ta_obj);
                    ta_struct.array_buffer = ar_obj;
                    break ta_obj;
                }
            } else unreachable;
            return @ptrCast(new_ta_obj);
        } else {
            return @ptrCast(ar_obj);
        }
    }
};

pub const ExternalAllocator = struct {
    const CallContext = struct {};
    const vtable: std.mem.Allocator.VTable = .{
        .alloc = alloc,
        .free = free,
        .remap = remap,
        .resize = resize,
    };

    pub fn fromValue(value_og: *const php.Value) !std.mem.Allocator {
        const obj = try php.getValueObject(value_og);
        return fromObject(@ptrCast(obj));
    }

    pub fn fromObject(obj: *Object) std.mem.Allocator {
        const allocator_struct = structure.Struct.fromObject(@ptrCast(obj));
        const allocator_class = ZigClassEntry.fromStructure(allocator_struct);
        // call convention is different between debug and release; when there's a mismatch
        // route call to function in the vtable through their thunks
        const debug = builtin.mode == .debug;
        if (allocator_class.host.module.attributes.debug != debug) {
            return .{
                .ptr = allocator_struct,
                .vtable = &vtable,
            };
        } else {
            const allocator_ptr: *std.mem.Allocator = @ptrCast(@alignCast(allocator_struct.buffer.bytes.ptr));
            return allocator_ptr.*;
        }
    }

    pub fn toValue(allocator: *const std.mem.Allocator) Value {
        const ptr: *anyopaque = init: {
            if (allocator.vtable == &vtable) {
                const allocator_struct: *structure.Struct = @ptrCast(@alignCast(allocator.ptr));
                break :init allocator_struct.buffer.bytes.ptr;
            } else {
                break :init @constCast(allocator);
            }
        };
        return .fromPointer(ptr);
    }

    fn invoke(context: *anyopaque, comptime name: []const u8, arg_struct: *ArgStruct(name)) !void {
        const allocator_struct: *structure.Struct = @ptrCast(@alignCast(context));
        // set the context pointer
        const ptr = try allocator_struct.getProperty(@ptrCast(N("ptr")), null);
        defer php.release(&ptr);
        const ptr_struct = try structure.Pointer.fromValue(&ptr);
        const ptr_address = try ptr_struct.getAddress();
        arg_struct.@"0" = @ptrFromInt(ptr_address);
        // retrieve thunk and function addresses
        const vtable_ptr = try allocator_struct.getProperty(@ptrCast(N("vtable")), null);
        defer php.release(&vtable_ptr);
        const vtable_ptr_struct = try structure.Pointer.fromValue(&vtable_ptr);
        const vtable_obj = try vtable_ptr_struct.getTarget();
        const vtable_struct = structure.Struct.fromObject(vtable_obj);
        const alloc_ptr = try vtable_struct.getProperty(@ptrCast(N(name)), null);
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
        for (f.param_types) |param_type| {
            if (param_type != null) {
                count += 1;
            }
        }
        break :get count;
    };
    var field_names: [count][]const u8 = undefined;
    var field_types: [count]type = undefined;
    var field_attrs: [count]std.lang.Type.Struct.FieldAttributes = undefined;
    field_names[0] = "retval";
    field_types[0] = if (f.return_type) |RT| switch (RT) {
        noreturn => void,
        else => RT,
    } else void;
    field_attrs[0] = .{};
    var arg_index = 0;
    for (f.param_types) |param_type| {
        if (param_type != null) {
            field_names[arg_index + 1] = std.fmt.comptimePrint("{d}", .{arg_index});
            field_types[arg_index + 1] = param_type.?;
            field_attrs[arg_index + 1] = .{};
            arg_index += 1;
        }
    }
    return @Struct(.auto, null, &field_names, &field_types, &field_attrs);
}
