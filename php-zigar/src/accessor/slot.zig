const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const Value = php.Value;

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
        return try accessor.read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.MultiSlot, buffer: *ByteBuffer, slots: *Value, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slots);
        try accessor.write(entry, value);
    }

    fn vivicateSlot(acc: *const accessor.MultiSlot, buffer: *ByteBuffer, slots: *Value) Error!*Value {
        const ht = try php.getValueHashTable(slots);
        return php.getHashEntry(ht, acc.params.slot) catch vivicate: {
            var new = try createObject(acc.params.class_entry, buffer, acc.params.byte_offset, acc.params.byte_size);
            break :vivicate php.insertHashEntry(ht, acc.params.slot, &new);
        };
    }
};

const single_slot = struct {
    pub fn get(acc: *const accessor.SingleSlot, buffer: *ByteBuffer, slot: *Value) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slot);
        return try accessor.read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.SingleSlot, buffer: *ByteBuffer, slot: *Value, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slot);
        try accessor.write(entry, value);
    }

    fn vivicateSlot(acc: *const accessor.SingleSlot, buffer: *ByteBuffer, slot: *Value) Error!*Value {
        if (php.getType(slot) == .null)
            slot.* = try createObject(acc.params.class_entry, buffer, acc.params.byte_offset, acc.params.byte_size);
        return slot;
    }
};

const array_slot = struct {
    pub fn get(acc: *const accessor.ArraySlot, buffer: *ByteBuffer, slots: *Value, index: usize) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slots, index);
        return try accessor.read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.ArraySlot, buffer: *ByteBuffer, slots: *Value, index: usize, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slots, index);
        try accessor.write(entry, value);
    }

    fn vivicateSlot(acc: *const accessor.ArraySlot, buffer: *ByteBuffer, slots: *Value, index: usize) Error!*Value {
        const ht = try php.getValueHashTable(slots);
        return php.getHashEntry(ht, acc.params.slot) catch vivicate: {
            var new = try createObject(acc.params.class_entry, buffer, acc.params.byte_size * index, acc.params.byte_size);
            break :vivicate php.insertHashEntry(ht, acc.params.slot, &new);
        };
    }
};

fn createObject(ce: *php.ClassEntry, buffer: *ByteBuffer, offset: usize, len: usize) !Value {
    const slice = try buffer.slice(offset, len);
    const object = ZigClass.createObjectWith(ce, slice, null) catch return error.CannotCreateObject;
    return php.createValueObject(object);
}

const multi_slot_prebaked = struct {
    pub fn get(acc: *const accessor.MultiSlotPrebaked, slots: *Value) Error!Value {
        const ht = try php.getValueHashTable(slots);
        const entry = try php.getHashEntry(ht, acc.params.slot);
        return try accessor.read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.MultiSlotPrebaked, slots: *Value, value: *const Value) Error!void {
        const ht = try php.getValueHashTable(slots);
        const entry = try php.getHashEntry(ht, acc.params.slot);
        try accessor.write(entry, value);
    }
};

const single_slot_prebaked = struct {
    pub fn get(acc: *const accessor.SingleSlotPrebaked, slot: *Value) Error!Value {
        return try accessor.read(slot, acc.params.transform);
    }

    pub fn set(_: *const accessor.SingleSlotPrebaked, slot: *Value, value: *const Value) Error!void {
        try accessor.write(slot, value);
    }
};
