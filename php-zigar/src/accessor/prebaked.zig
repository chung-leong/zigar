const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;
const zig_object = @import("../zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const Attributes = struct {};

pub fn get(comptime _: Attributes, params: accessor.Prebaked.Parameters) accessor.Prebaked {
    const ns = struct {
        pub fn get(acc: *const accessor.Prebaked, slots: *HashTable) Error!Value {
            const entry = try php.getHashEntry(slots, acc.params.slot);
            return entry.*;
        }

        pub fn set(acc: *const accessor.Prebaked, slots: *HashTable, value: *Value) Error!void {
            const entry = try php.getHashEntry(slots, acc.params.slot);
            const obj = php.getValueObject(entry) catch unreachable;
            const func_ptr = obj.handlers.*.write_property.?;
            _ = func_ptr(obj, zig_object.dollar_sign, value, null);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
