const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Value = php.Value;
const structure = @import("../structure.zig");
const invokeMethod = structure.invokeMethod;

pub const Attributes = struct {
    type: accessor.SlotAccessorType,
};

fn Parameters(comptime attrs: Attributes) type {
    return switch (attrs.type) {
        .multi_slot => accessor.MultiSlot.Parameters,
        .single_slot => accessor.SingleSlot.Parameters,
        .array_slot => accessor.ArraySlot.Parameters,
        .multi_slot_prebaked => accessor.MultiSlotPrebaked.Parameters,
        .single_slot_prebaked => accessor.SingleSlotPrebaked.Parameters,
    };
}

fn Accessors(comptime attrs: Attributes) type {
    return switch (attrs.type) {
        .multi_slot => accessor.MultiSlot,
        .single_slot => accessor.SingleSlot,
        .array_slot => accessor.ArraySlot,
        .multi_slot_prebaked => accessor.MultiSlotPrebaked,
        .single_slot_prebaked => accessor.SingleSlotPrebaked,
    };
}

pub fn get(comptime attrs: Attributes, params: Parameters(attrs)) Accessors(attrs) {
    const ns = switch (attrs.type) {
        .multi_slot => multi_slot,
        .single_slot => single_slot,
        .array_slot => array_slot,
        .multi_slot_prebaked => multi_slot_prebaked,
        .single_slot_prebaked => single_slot_prebaked,
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}

const multi_slot = struct {
    pub fn get(acc: *const accessor.MultiSlot, buffer: *ByteBuffer, slots: *Value) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slots);
        php.addRef(entry);
        return entry.*;
    }

    pub fn set(acc: *const accessor.MultiSlot, buffer: *ByteBuffer, slots: *Value, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slots);
        try write(entry, value, false);
    }

    fn vivicateSlot(acc: *const accessor.MultiSlot, buffer: *ByteBuffer, slots: *Value) Error!*Value {
        const ht = try php.getValueHashTable(slots);
        return php.getHashEntry(ht, acc.params.slot) catch vivicate: {
            const offset = acc.params.byte_offset;
            const len = acc.params.byte_size;
            const new_obj = try acc.params.class.createObjectFromSlice(buffer, offset, len);
            var new_value = php.createValueObject(new_obj);
            break :vivicate php.insertHashEntry(ht, acc.params.slot, &new_value);
        };
    }
};

const single_slot = struct {
    pub fn get(acc: *const accessor.SingleSlot, buffer: *ByteBuffer, slot: *Value) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slot);
        php.addRef(entry);
        return entry.*;
    }

    pub fn set(acc: *const accessor.SingleSlot, buffer: *ByteBuffer, slot: *Value, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slot);
        try write(entry, value, false);
    }

    fn vivicateSlot(acc: *const accessor.SingleSlot, buffer: *ByteBuffer, slot: *Value) Error!*Value {
        if (php.getType(slot) == .null) {
            const offset = acc.params.byte_offset;
            const len = acc.params.byte_size;
            const new_obj = try acc.params.class.createObjectFromSlice(buffer, offset, len);
            slot.* = php.createValueObject(new_obj);
        }
        return slot;
    }
};

const array_slot = struct {
    pub fn get(acc: *const accessor.ArraySlot, buffer: *ByteBuffer, slots: *Value, index: usize) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slots, index);
        php.addRef(entry);
        return entry.*;
    }

    pub fn set(acc: *const accessor.ArraySlot, buffer: *ByteBuffer, slots: *Value, index: usize, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slots, index);
        try write(entry, value, false);
    }

    fn vivicateSlot(acc: *const accessor.ArraySlot, buffer: *ByteBuffer, slots: *Value, index: usize) Error!*Value {
        const ht = try php.getValueHashTable(slots);
        const key: c_long = @intCast(index);
        return php.getHashEntry(ht, key) catch vivicate: {
            const offset = acc.params.byte_size * index;
            const len = acc.params.byte_size;
            const new_obj = try acc.params.class.createObjectFromSlice(buffer, offset, len);
            var new_value = php.createValueObject(new_obj);
            break :vivicate php.insertHashEntry(ht, key, &new_value);
        };
    }
};

const multi_slot_prebaked = struct {
    pub fn get(acc: *const accessor.MultiSlotPrebaked, slots: *Value) Error!Value {
        const ht = try php.getValueHashTable(slots);
        const entry = try php.getHashEntry(ht, acc.params.slot);
        php.addRef(entry);
        return entry.*;
    }

    pub fn set(acc: *const accessor.MultiSlotPrebaked, slots: *Value, value: *const Value) Error!void {
        const ht = try php.getValueHashTable(slots);
        const entry = try php.getHashEntry(ht, acc.params.slot);
        try write(entry, value, true);
    }
};

const single_slot_prebaked = struct {
    pub fn get(_: *const accessor.SingleSlotPrebaked, slot: *Value) Error!Value {
        php.addRef(slot);
        return slot.*;
    }

    pub fn set(_: *const accessor.SingleSlotPrebaked, slot: *Value, value: *const Value) Error!void {
        try write(slot, value, true);
    }
};

fn write(entry: *Value, value: *const Value, comptime prebaked: bool) Error!void {
    if (php.getValueObject(entry)) |obj| {
        try invokeMethod(obj, "writeSelf", .{value});
    } else |_| {
        const msg = switch (prebaked) {
            true => "cannot create comptime object",
            false => "attempt to write to null target",
        };
        return php.throwExceptionFmt("{s} (zig)", .{msg});
    }
}
