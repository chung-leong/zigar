const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Attributes = struct {
    slots: enum { multiple, single } = .multiple,
    index: enum { none, use } = .none,
    prebaked: bool = false,
};

pub fn Slot(comptime attrs: Attributes) type {
    return switch (attrs.prebaked) {
        false => switch (attrs.slots) {
            .multiple => switch (attrs.index) {
                .none => struct {
                    slot: usize,
                    byte_size: usize,
                    byte_offset: usize,
                    class: *ZigClassEntry,
                    output: accessor.Output,
                    transform: ?accessor.Transform,
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,

                    pub fn get(self: @This(), buffer: *ByteBuffer, table: *Value) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table);
                        return try getValue(entry, self.transform);
                    }

                    pub fn getEx(self: @This(), buffer: *ByteBuffer, table: *Value, transform: ?accessor.Transform) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table);
                        return try getValueEx(entry, self.transform, transform);
                    }

                    pub fn set(self: @This(), buffer: *ByteBuffer, table: *Value, value: *const Value) Error!void {
                        const entry = try self.vivicateSlot(buffer, table);
                        try setValue(entry, value, self.transform);
                    }

                    fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value) Error!*Value {
                        const ht = try php.getValueHashTable(table);
                        return php.getHashEntry(ht, self.slot) catch vivicate: {
                            const offset = self.byte_offset;
                            const len = self.byte_size;
                            const new_obj = try self.class.obtainObjectAtOffset(buffer, offset, len);
                            var new_value = php.createValueObject(new_obj);
                            break :vivicate php.insertHashEntry(ht, self.slot, &new_value);
                        };
                    }
                },
                .use => struct {
                    byte_size: usize,
                    class: *ZigClassEntry,
                    transform: ?accessor.Transform,
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,

                    pub fn getElement(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        return try getValue(entry, self.transform);
                    }

                    pub fn getElementEx(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize, transform: ?accessor.Transform) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        return try getValueEx(entry, self.transform, transform);
                    }

                    pub fn setElement(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize, value: *const Value) Error!void {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        try setValue(entry, value, self.transform);
                    }

                    fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize) Error!*Value {
                        const ht = try php.getValueHashTable(table);
                        const key: c_long = @intCast(index);
                        return php.getHashEntry(ht, key) catch vivicate: {
                            const offset = self.byte_size * index;
                            const len = self.byte_size;
                            const new_obj = try self.class.obtainObjectAtOffset(buffer, offset, len);
                            var new_value = php.createValueObject(new_obj);
                            break :vivicate php.insertHashEntry(ht, key, &new_value);
                        };
                    }
                },
            },
            .single => struct {
                byte_size: usize,
                byte_offset: usize,
                class: *ZigClassEntry,
                transform: ?accessor.Transform,
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,

                pub fn get(self: @This(), buffer: *ByteBuffer, table: *Value) Error!Value {
                    const entry = try self.vivicateSlot(buffer, table);
                    return getValue(entry, self.transform);
                }

                pub fn getEx(self: @This(), buffer: *ByteBuffer, table: *Value, transform: ?accessor.Transform) Error!Value {
                    const entry = try self.vivicateSlot(buffer, table);
                    return getValue(entry, self.transform, transform);
                }

                pub fn set(self: @This(), buffer: *ByteBuffer, table: *Value, value: *const Value) Error!void {
                    const entry = try self.vivicateSlot(buffer, table);
                    try setValue(entry, value, self.transform);
                }

                fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value) Error!*Value {
                    if (php.getValueType(table) == .null) {
                        const offset = self.byte_offset;
                        const len = self.byte_size;
                        const new_obj = try self.class.obtainObjectAtOffset(buffer, offset, len);
                        table.* = php.createValueObject(new_obj);
                    }
                    return table;
                }
            },
        },
        true => switch (attrs.slots) {
            .multiple => struct {
                slot: usize,
                output: accessor.Output,
                transform: ?accessor.Transform,
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,

                pub fn get(self: @This(), table: *Value) Error!Value {
                    const ht = try php.getValueHashTable(table);
                    const entry = try php.getHashEntry(ht, self.slot);
                    return try getValue(entry, self.transform);
                }

                pub fn getEx(self: @This(), table: *Value, transform: ?accessor.Transform) Error!Value {
                    const ht = try php.getValueHashTable(table);
                    const entry = try php.getHashEntry(ht, self.slot);
                    return try getValueEx(entry, self.transform, transform);
                }

                pub fn set(self: @This(), table: *Value, value: *const Value) Error!void {
                    const ht = try php.getValueHashTable(table);
                    const entry = try php.getHashEntry(ht, self.slot);
                    try setValue(entry, value, self.transform);
                }
            },
            .single => struct {
                transform: ?accessor.Transform,
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,

                pub fn get(self: @This(), table: *Value) Error!Value {
                    return try getValue(table, self.transform);
                }

                pub fn getEx(self: @This(), table: *Value, transform: ?accessor.Transform) Error!Value {
                    return try getValueEx(table, self.transform, transform);
                }

                pub fn set(self: @This(), table: *Value, value: *const Value) Error!void {
                    try setValue(table, value, self.transform);
                }
            },
        },
    };
}

fn getValue(entry: *Value, transform: ?accessor.Transform) Error!Value {
    if (transform) |tm| {
        const obj = php.getValueObject(entry) catch return error.NullPointer;
        return try structure.invokeMethod(obj, "getValue", .{tm});
    } else {
        php.addRef(entry);
        return entry.*;
    }
}

fn getValueEx(entry: *Value, transform1: ?accessor.Transform, transform2: ?accessor.Transform) !Value {
    // use the second if it's null or if the first is null or none
    const transform = if (transform2 == null)
        null
    else if (transform1 == null or transform1 == .none)
        transform2
    else
        transform1;
    return getValue(entry, transform);
}

fn setValue(entry: *Value, value: *const Value, transform: ?accessor.Transform) Error!void {
    const obj = php.getValueObject(entry) catch return error.NullPointer;
    try structure.invokeMethod(obj, "setValue", .{ value, transform orelse .none });
}
