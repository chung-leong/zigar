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

pub const Attributes = struct {
    type: accessor.SlotAccessorType,
};

fn Parameters(comptime attrs: Attributes) type {
    return switch (attrs.type) {
        .regular => accessor.Slot.Parameters,
        .array => accessor.SlotArray.Parameters,
        .prebaked => accessor.SlotPrebaked.Parameters,
    };
}

fn Accessors(comptime attrs: Attributes) type {
    return switch (attrs.type) {
        .regular => accessor.Slot,
        .array => accessor.SlotArray,
        .prebaked => accessor.SlotPrebaked,
    };
}

pub fn get(comptime attrs: Attributes, params: Parameters(attrs)) Accessors(attrs) {
    const ns = switch (attrs.type) {
        .regular => regular,
        .array => array,
        .prebaked => prebaked,
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}

const regular = struct {
    pub fn get(acc: *const accessor.Slot, buffer: *ByteBuffer, slots: *HashTable) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slots);
        return read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.Slot, buffer: *ByteBuffer, slots: *HashTable, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slots);
        try write(entry, value);
    }

    fn vivicateSlot(acc: *const accessor.Slot, buffer: *ByteBuffer, slots: *HashTable) Error!*Value {
        return php.getHashEntry(slots, acc.params.slot) catch vivicate: {
            var new = try createObject(acc.params.class_entry, buffer, acc.params.byte_offset, acc.params.byte_size);
            break :vivicate try php.insertHashEntry(slots, acc.params.slot, &new);
        };
    }
};

const array = struct {
    pub fn get(acc: *const accessor.SlotArray, buffer: *ByteBuffer, slots: *HashTable, index: usize) Error!Value {
        const entry = try vivicateSlot(acc, buffer, slots, index);
        return read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.SlotArray, buffer: *ByteBuffer, slots: *HashTable, index: usize, value: *const Value) Error!void {
        const entry = try vivicateSlot(acc, buffer, slots, index);
        try write(entry, value);
    }

    fn vivicateSlot(acc: *const accessor.SlotArray, buffer: *ByteBuffer, slots: *HashTable, index: usize) Error!*Value {
        return php.getHashEntry(slots, acc.params.slot) catch vivicate: {
            var new = try createObject(acc.params.class_entry, buffer, acc.params.byte_size * index, acc.params.byte_size);
            break :vivicate try php.insertHashEntry(slots, acc.params.slot, &new);
        };
    }
};

fn createObject(ce: *php.ClassEntry, buffer: *ByteBuffer, offset: usize, len: usize) !Value {
    const slice = try buffer.slice(offset, len);
    var memory = php.createValuePointer(slice);
    const object = ZigClass.createObjectWith(ce, &memory, null) catch return error.CannotCreateObject;
    return php.createValueObject(object);
}

const prebaked = struct {
    pub fn get(acc: *const accessor.SlotPrebaked, slots: *HashTable) Error!Value {
        const entry = try php.getHashEntry(slots, acc.params.slot);
        return read(entry, acc.params.transform);
    }

    pub fn set(acc: *const accessor.SlotPrebaked, slots: *HashTable, value: *const Value) Error!void {
        const entry = try php.getHashEntry(slots, acc.params.slot);
        try write(entry, value);
    }
};

pub fn read(entry: *Value, transform: accessor.Transform) Value {
    switch (transform) {
        .none => return entry.*,
        .to_string, .to_plain => {
            unreachable; // TODO
        },
        .to_value => {
            const obj = php.getValueObject(entry) catch unreachable;
            const handlers: *const zig_object.ObjectHandlers = @ptrCast(obj.handlers);
            return handlers.read_self.?(obj);
        },
    }
}

pub fn write(entry: *Value, value: *const Value) Error!void {
    const obj = php.getValueObject(entry) catch unreachable;
    const handlers: *const zig_object.ObjectHandlers = @ptrCast(obj.handlers);
    handlers.write_self.?(obj, value);
}
