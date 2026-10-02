const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Error = @import("../failure.zig").Error;
const php_ng = @import("../php/root.zig");
const Value = php_ng.Value;
const structure = @import("../structure.zig");

pub fn @"fn"(comptime attrs: Attributes) type {
    return switch (attrs.prebaked) {
        false => switch (attrs.slots) {
            .multiple => switch (attrs.index) {
                .none => struct {
                    slot: usize,
                    byte_size: usize,
                    byte_offset: usize,
                    bit_offset: u3,
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

                    pub fn getEntry(self: @This(), buffer: *ByteBuffer, table: *Value, vivicate: bool) Error!?*Value {
                        const array = try table.getArray();
                        return array.getPointer(self.slot) catch if (vivicate) create: {
                            const offset = self.byte_offset;
                            const len = self.byte_size;
                            const bit_offset = self.bit_offset;
                            const new_obj = try self.class.obtainObjectAtOffset(buffer, offset, len, bit_offset);
                            break :create array.insert(self.slot, .fromObject(new_obj));
                        } else null;
                    }

                    pub fn set(self: @This(), buffer: *ByteBuffer, table: *Value, value: Value) Error!void {
                        const entry = try self.vivicateSlot(buffer, table);
                        try setValue(entry, value, self.transform, attrs.prebaked);
                    }

                    fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value) Error!*Value {
                        const result = try self.getEntry(buffer, table, true);
                        return result.?;
                    }
                },
                .use => struct {
                    pub fn getElement(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        return try getValue(entry, self.transform);
                    }

                    pub fn getElementEx(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize, transform: ?accessor.Transform) Error!Value {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        return try getValueEx(entry, self.transform, transform);
                    }

                    pub fn setElement(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize, value: Value) Error!void {
                        const entry = try self.vivicateSlot(buffer, table, index);
                        try setValue(entry, value, self.transform, attrs.prebaked);
                    }

                    pub fn getElementEntry(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize, vivicate: bool) Error!?*Value {
                        const array = try table.getArray();
                        const key: c_long = @intCast(index);
                        return array.getPointer(key) catch if (vivicate) create: {
                            if (array.nNumOfElements > 64) {
                                // start removing unreferenced children when the hash table
                                // reaches a certain size
                                var iter = array.iterate(.{});
                                var failed: usize = 0;
                                while (iter.next()) |child| {
                                    if (child.getObject() catch null) |child_obj| {
                                        if (child_obj.gc.refcount == 1) {
                                            const child_key = iter.index().?;
                                            array.delete(child_key);
                                        } else {
                                            failed += 1;
                                            if (failed > 8) break;
                                        }
                                    }
                                }
                            }
                            const offset = self.byte_size * index;
                            const len = self.byte_size;
                            const new_obj = try self.class.obtainObjectAtOffset(buffer, offset, len, 0);
                            break :create array.insert(key, .fromObject(new_obj));
                        } else null;
                    }

                    fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value, index: usize) Error!*Value {
                        const result = try self.getElementEntry(buffer, table, index, true);
                        return result.?;
                    }

                    byte_size: usize,
                    class: *ZigClassEntry,
                    transform: ?accessor.Transform,
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,
                },
            },
            .single => struct {
                pub fn get(self: @This(), buffer: *ByteBuffer, table: *Value) Error!Value {
                    const entry = try self.vivicateSlot(buffer, table);
                    return getValue(entry, self.transform);
                }

                pub fn getEx(self: @This(), buffer: *ByteBuffer, table: *Value, transform: ?accessor.Transform) Error!Value {
                    const entry = try self.vivicateSlot(buffer, table);
                    return getValue(entry, self.transform, transform);
                }

                pub fn getEntry(self: @This(), buffer: *ByteBuffer, table: *Value, vivicate: bool) Error!?*Value {
                    if (table.isNull() and vivicate) {
                        const offset = self.byte_offset;
                        const len = self.byte_size;
                        const bit_offset = self.bit_offset;
                        const new_obj = try self.class.obtainObjectAtOffset(buffer, offset, len, bit_offset);
                        table.* = .fromObject(new_obj);
                    }
                    return table;
                }

                pub fn set(self: @This(), buffer: *ByteBuffer, table: *Value, value: Value) Error!void {
                    const entry = try self.vivicateSlot(buffer, table);
                    try setValue(entry, value, self.transform, attrs.prebaked);
                }

                fn vivicateSlot(self: @This(), buffer: *ByteBuffer, table: *Value) Error!*Value {
                    const result = try self.getEntry(buffer, table, true);
                    return result.?;
                }

                byte_size: usize,
                byte_offset: usize,
                bit_offset: u3,
                class: *ZigClassEntry,
                transform: ?accessor.Transform,
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,
            },
        },
        true => switch (attrs.slots) {
            .multiple => switch (attrs.index) {
                .none => struct {
                    pub fn get(self: @This(), table: *Value) Error!Value {
                        const array = try table.getArray();
                        const entry = try array.getPointer(self.slot);
                        return try getValue(entry, self.transform);
                    }

                    pub fn getEx(self: @This(), table: *Value, transform: ?accessor.Transform) Error!Value {
                        const array = try table.getArray();
                        const entry = try array.getPointer(self.slot);
                        return try getValueEx(entry, self.transform, transform);
                    }

                    pub fn getEntry(self: @This(), table: *Value, _: bool) Error!?*Value {
                        const array = try table.getArray();
                        return try array.get(self.slot);
                    }

                    pub fn set(self: @This(), table: *Value, value: Value) Error!void {
                        const array = try table.getArray();
                        const entry = try array.getPointer(self.slot);
                        try setValue(entry, value, self.transform, attrs.prebaked);
                    }

                    slot: usize,
                    output: accessor.Output,
                    transform: ?accessor.Transform,
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,
                },
                .use => struct {
                    pub fn getElement(self: @This(), table: *Value, index: usize) Error!Value {
                        const array = try table.getArray();
                        const entry = try array.getPointer(index);
                        return try getValue(entry, self.transform);
                    }

                    pub fn getElementEx(self: @This(), table: *Value, index: usize, transform: ?accessor.Transform) Error!Value {
                        const array = try table.getArray();
                        const entry = try array.getPointer(index);
                        return try getValueEx(entry, self.transform, transform);
                    }

                    pub fn getElementEntry(_: @This(), table: *Value, index: usize, _: bool) Error!?*Value {
                        const array = try table.getArray();
                        return try array.getPointer(index);
                    }

                    pub fn setElement(self: @This(), table: *Value, index: usize, value: *const Value) Error!void {
                        const array = try table.getArray();
                        const entry = try array.getPointer(index);
                        try setValue(entry, value, self.transform, attrs.prebaked);
                    }

                    output: accessor.Output,
                    transform: ?accessor.Transform,
                    comptime type: accessor.Type = .slot,
                    comptime attributes: Attributes = attrs,
                },
            },
            .single => struct {
                pub fn get(self: @This(), table: *Value) Error!Value {
                    return try getValue(table, self.transform);
                }

                pub fn getEx(self: @This(), table: *Value, transform: ?accessor.Transform) Error!Value {
                    return try getValueEx(table, self.transform, transform);
                }

                pub fn getEntry(_: @This(), table: *Value, _: bool) Error!?*Value {
                    return table;
                }

                pub fn set(self: @This(), table: *Value, value: *const Value) Error!void {
                    try setValue(table, value, self.transform, attrs.prebaked);
                }

                transform: ?accessor.Transform,
                comptime type: accessor.Type = .slot,
                comptime attributes: Attributes = attrs,
            },
        },
    };
}

fn getValue(entry: *Value, transform: ?accessor.Transform) Error!Value {
    if (transform) |tm| {
        const obj = entry.getObject() catch return error.NullPointer;
        return try structure.invokeMethod(obj, "getValue", .{tm});
    } else {
        return entry.retain().*;
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

fn setValue(entry: *Value, value: Value, transform: ?accessor.Transform, comptime prebaked: bool) Error!void {
    const obj = entry.getObject() catch {
        return if (prebaked) error.ComptimeValue else error.NullPointer;
    };
    try structure.invokeMethod(obj, "setValue", .{ value, transform orelse .none });
}

const Attributes = struct {
    slots: enum { multiple, single },
    index: enum { none, use } = .none,
    prebaked: bool = false,
};
