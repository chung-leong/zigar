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
const prebaked = @import("prebaked.zig");
const read = prebaked.read;
const write = prebaked.write;

pub const Attributes = struct {};

pub fn get(comptime _: Attributes, params: accessor.Complex.Parameters) accessor.Complex {
    const ns = struct {
        pub fn get(acc: *const accessor.Complex, buffer: *ByteBuffer, slots: *HashTable) Error!Value {
            const entry = try vivicateSlot(acc, buffer, slots);
            return read(entry, acc.params.transform);
        }

        pub fn set(acc: *const accessor.Complex, buffer: *ByteBuffer, slots: *HashTable, value: *Value) Error!void {
            const entry = try vivicateSlot(acc, buffer, slots);
            try write(entry, value);
        }

        fn vivicateSlot(acc: *const accessor.Complex, buffer: *ByteBuffer, slots: *HashTable) Error!*Value {
            return php.getHashEntry(slots, acc.params.slot) catch vivicate: {
                const slice = try buffer.slice(acc.params.byte_offset, acc.params.byte_size);
                var memory = php.createValuePointer(slice);
                const object = ZigClass.createObjectWith(acc.params.class_entry, &memory, null) catch return error.CannotCreateObject;
                var new = php.createValueObject(object);
                break :vivicate try php.insertHashEntry(slots, acc.params.slot, &new);
            };
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
