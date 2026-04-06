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
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,

                    pub fn get(self: @This(), buffer: *ByteBuffer, table: *Value) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table);
                        php.addRef(entry);
                        return entry.*;
                    }

                    pub fn set(self: @This(), buffer: *ByteBuffer, table: *Value, value: *const Value) Error!void {
                        const entry = try self.vivicateSlot(buffer, table);
                        try write(entry, value, false);
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
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,

                    pub fn getElement(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        php.addRef(entry);
                        return entry.*;
                    }

                    pub fn setElement(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize, value: *const Value) Error!void {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        try write(entry, value, false);
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
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,

                pub fn get(self: @This(), buffer: *ByteBuffer, table: *Value) Error!Value {
                    const entry = try self.vivicateSlot(buffer, table);
                    php.addRef(entry);
                    return entry.*;
                }

                pub fn set(self: @This(), buffer: *ByteBuffer, table: *Value, value: *const Value) Error!void {
                    const entry = try self.vivicateSlot(buffer, table);
                    try write(entry, value, false);
                }

                fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value) Error!*Value {
                    if (php.getType(table) == .null) {
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
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,

                pub fn get(self: @This(), table: *Value) Error!Value {
                    const ht = try php.getValueHashTable(table);
                    const entry = try php.getHashEntry(ht, self.slot);
                    php.addRef(entry);
                    return entry.*;
                }

                pub fn set(self: @This(), table: *Value, value: *const Value) Error!void {
                    const ht = try php.getValueHashTable(table);
                    const entry = try php.getHashEntry(ht, self.slot);
                    try write(entry, value, true);
                }
            },
            .single => struct {
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,

                pub fn get(_: @This(), table: *Value) Error!Value {
                    php.addRef(table);
                    return table.*;
                }

                pub fn set(_: @This(), table: *Value, value: *const Value) Error!void {
                    try write(table, value, true);
                }
            },
        },
    };
}

fn write(entry: *Value, value: *const Value, comptime prebaked: bool) Error!void {
    if (php.getValueObject(entry)) |obj| {
        try structure.invokeMethod(obj, "setValue", .{value});
    } else |_| {
        const msg = switch (prebaked) {
            true => "cannot create comptime object",
            false => "attempt to write to null target",
        };
        return php.throwExceptionFmt("{s} (zig)", .{msg});
    }
}
