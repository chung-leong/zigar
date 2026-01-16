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

pub fn get(comptime _: Attributes, params: accessor.Object.Parameters) accessor.Object {
    const ns = struct {
        pub fn get(acc: *const accessor.Object, buffer: *ByteBuffer, slots: *HashTable, cache_slot: ?*?*anyopaque) Error!Value {
            const entry = try getSlotEntry(acc, buffer, slots, cache_slot);
            return entry.*;
        }

        pub fn set(acc: *const accessor.Object, buffer: *ByteBuffer, slots: *HashTable, value: *Value, cache_slot: ?*?*anyopaque) Error!void {
            const entry = try getSlotEntry(acc, buffer, slots, cache_slot);
            const obj = php.getValueObject(entry) catch unreachable;
            const func_ptr = obj.handlers.*.write_property.?;
            _ = func_ptr(obj, zig_object.dollar_sign, value, null);
        }

        fn getSlotEntry(acc: *const accessor.Object, buffer: *ByteBuffer, slots: *HashTable, cache_slot: ?*?*anyopaque) Error!*Value {
            if (cache_slot) |slot| if (slot.*) |ptr| return @ptrCast(@alignCast(ptr));
            const entry = php.getHashEntry(slots, acc.params.slot) catch try vivicateSlot(acc, buffer, slots);
            if (cache_slot) |slot| slot.* = entry;
            return entry;
        }

        fn vivicateSlot(acc: *const accessor.Object, buffer: *ByteBuffer, slots: *HashTable) Error!*Value {
            const slice = try buffer.slice(acc.params.byte_offset, acc.params.byte_size);
            var memory = php.createValuePointer(slice);
            const object = ZigClass.createObjectWith(acc.params.class_entry, &memory, null) catch return error.CannotCreateObject;
            var new = php.createValueObject(object);
            return try php.insertHashEntry(slots, acc.params.slot, &new);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
