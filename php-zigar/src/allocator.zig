const std = @import("std");

const ArrayBuffer = @import("js-compat.zig").ArrayBuffer;
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const failure = @import("failure.zig");
const getObjectBuffer = @import("object.zig").getObjectBuffer;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
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
        if (arg_iter.len < 1 or arg_iter.len > 2) return failure.reportArgCountMismatch("alloc", 1, 2, arg_iter.len);
        const arg0 = arg_iter.next().?;
        const len = try php.getValueUlong(arg0);
        const alignment_bu = if (arg_iter.next()) |arg1| try php.getValueUlong(arg1) else 1;
        if (!std.math.isPowerOfTwo(alignment_bu)) return error.InvalidAligment;
        const alignment = std.mem.Alignment.fromByteUnits(alignment_bu);
        const allocator = try getAllocatorFromThis(&arg_iter);
        const buf = try ByteBuffer.create(alignment);
        errdefer buf.release();
        try buf.allocate(allocator, len);
        defer buf.release();
        const ar_obj = try ArrayBuffer.create(buf);
        _ = buf.externalize();
        return_value.* = php.createValueObject(ar_obj);
    }

    pub fn handleFree(ed: *ExecuteData, _: *Value) !void {
        var arg_iter: ArgumentIterator = .init(ed);
        if (arg_iter.len != 1) return failure.reportArgCountMismatch("free", 1, 1, arg_iter.len);
        const arg0 = arg_iter.next().?;
        var obj = try php.getValueObject(arg0);
        const buf = get: {
            if (php.instanceOf(obj, ArrayBuffer.entry())) {
                const ar = ArrayBuffer.fromObject(obj);
                break :get ar.buffer;
            } else if (ZigClassEntry.isZig(obj.ce)) {
                const class = ZigClassEntry.fromObject(obj);
                if (class.type == .pointer) {
                    // dereference pointer
                    const ptr_struct = structure.Pointer.fromObject(obj);
                    obj = try ptr_struct.getTarget();
                }
                break :get getObjectBuffer(obj);
            } else {
                return error.InvalidOperation;
            }
        };
        if (!buf.inZigMemory()) return error.InvalidOperation;
        const allocator = try getAllocatorFromThis(&arg_iter);
        switch (buf.source_type) {
            .allocator => {
                if (buf.source.allocator != allocator) return error.InvalidOperation;
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
        if (arg_iter.len != 1) return failure.reportArgCountMismatch("dupe", 1, 2, arg_iter.len);
        const arg0 = arg_iter.next().?;
        const bytes = get: {
            if (php.getValueString(arg0)) |str| {
                break :get php.getStringContent(str);
            } else |_| {
                const obj = try php.getValueObject(arg0);
                if (php.instanceOf(obj, ArrayBuffer.entry())) {
                    const ar = ArrayBuffer.fromObject(obj);
                    break :get try ar.buffer.data(0, false);
                }
            }
            return error.InvalidOperation;
        };
        const allocator = try getAllocatorFromThis(&arg_iter);
        const buf = try ByteBuffer.create(.@"1");
        try buf.allocate(allocator, bytes.len);
        defer buf.release();
        try buf.copyBytes(bytes);
        const ar_obj = try ArrayBuffer.create(buf);
        _ = buf.externalize();
        return_value.* = php.createValueObject(ar_obj);
    }

    fn getAllocatorFromThis(arg_iter: *ArgumentIterator) !*std.mem.Allocator {
        const this_obj = try php.getValueObject(arg_iter.this);
        const this_struct = structure.Struct.fromObject(this_obj);
        return try this_struct.getAllocator();
    }
};
