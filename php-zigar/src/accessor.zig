const std = @import("std");

pub const boolean = @import("accessor/boolean.zig");
pub const float = @import("accessor/float.zig");
pub const int = @import("accessor/int.zig");
pub const @"null" = @import("accessor/null.zig");
pub const slot = @import("accessor/slot.zig");
pub const vector = @import("accessor/vector.zig");
pub const @"void" = @import("accessor/void.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const invokeFunction = @import("structure.zig").invokeFunction;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const Error = error{
    CannotCreateObject,
    ExceptionThrown,
    Failure,
    InvalidOperation,
    InvalidType,
    Missing,
    NotArray,
    NotArrayOrObject,
    NotBoolean,
    NotDouble,
    NotInteger,
    NotNull,
    NotObject,
    NotString,
    NotStringKey,
    OutOfBound,
    OutOfMemory,
    Unexpected,
    Unsupported,
    WriteProtected,
};

pub const Transform = enum { to_string, to_plain, to_value };

pub const Null = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {};
    pub const Getter = fn (*const @This()) Error!Value;
    pub const Setter = fn (*const @This(), *const Value) Error!void;

    pub fn get(self: *const @This()) Error!Value {
        return try self.getter(self);
    }

    pub fn set(self: *const @This(), value: *const Value) Error!void {
        return try self.setter(self, value);
    }
};

pub const Primitive = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,
    stringifier: *const Stringifier,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *const Value) Error!void;
    pub const Stringifier = fn (*const @This(), *ByteBuffer) Error!Value;

    pub fn get(self: *const @This(), buffer: *ByteBuffer) Error!Value {
        return try self.getter(self, buffer);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
        return try self.setter(self, buffer, value);
    }

    pub fn stringify(self: *const @This(), buffer: *ByteBuffer) Error!Value {
        return try self.stringifier(self, buffer);
    }
};

pub const Vector = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {};
    pub const Getter = fn (*const @This(), *ByteBuffer, usize) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, usize, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, index: usize) Error!Value {
        return try self.getter(self, buffer, index);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, index: usize, value: *const Value) Error!void {
        return try self.setter(self, buffer, index, value);
    }
};

pub const SlotAccessorType = enum { multi_slot, single_slot, multi_slot_prebaked, single_slot_prebaked, array_slot };

pub const MultiSlot = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
        byte_size: usize,
        slot: usize,
        class: *ZigClassEntry,
        transform: ?Transform = null,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *Value) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *Value) Error!Value {
        return try self.getter(self, buffer, slots);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, buffer, slots, value);
    }
};

pub const SingleSlot = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
        byte_size: usize,
        class: *ZigClassEntry,
        transform: ?Transform = null,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *Value) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *Value) Error!Value {
        return try self.getter(self, buffer, slots);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, buffer, slots, value);
    }
};

pub const ArraySlot = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_size: usize,
        slot: usize,
        class: *ZigClassEntry,
        transform: ?Transform = null,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *Value, usize) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value, usize, *const Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *Value, index: usize) Error!Value {
        return try self.getter(self, buffer, slots, index);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *Value, index: usize, value: *const Value) Error!void {
        return try self.setter(self, buffer, slots, index, value);
    }
};

pub const MultiSlotPrebaked = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        slot: usize,
        transform: ?Transform = null,
    };
    pub const Getter = fn (*const @This(), *Value) Error!Value;
    pub const Setter = fn (*const @This(), *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), slots: *Value) Error!Value {
        return try self.getter(self, slots);
    }

    pub fn set(self: *const @This(), slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, slots, value);
    }
};

pub const SingleSlotPrebaked = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        transform: ?Transform = null,
    };
    pub const Getter = fn (*const @This(), *Value) Error!Value;
    pub const Setter = fn (*const @This(), *Value, *const Value) Error!void;

    pub fn get(self: *const @This(), slots: *Value) Error!Value {
        return try self.getter(self, slots);
    }

    pub fn set(self: *const @This(), slots: *Value, value: *const Value) Error!void {
        return try self.setter(self, slots, value);
    }
};

pub const Any = union(enum) {
    primitive: Primitive,
    vector: Vector,
    multi_slot: MultiSlot,
    single_slot: SingleSlot,
    array_slot: ArraySlot,
    multi_slot_prebaked: MultiSlotPrebaked,
    single_slot_prebaked: SingleSlotPrebaked,
    null: Null,
    missing: void,

    pub fn get(self: *const @This(), source: anytype) !Value {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .primitive => |acc| if (@hasField(S, "bytes"))
                return try acc.get(source.bytes),
            inline .multi_slot, .single_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.get(source.bytes, &source.slots),
            inline .multi_slot_prebaked, .single_slot_prebaked => |acc| if (@hasField(S, "slots"))
                return try acc.get(&source.slots),
            .null => |acc| return try acc.get(),
            else => {},
        }
        return error.InvalidOperation;
    }

    pub fn getElement(self: *const @This(), source: anytype, index: usize) !Value {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .vector => |acc| if (@hasField(S, "bytes"))
                return try acc.get(source.bytes, index),
            .array_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.get(source.bytes, &source.slots, index),
            else => {},
        }
        return error.InvalidOperation;
    }

    pub fn set(self: *const @This(), source: anytype, value: *const Value) !void {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .primitive => |acc| if (@hasField(S, "bytes"))
                return try acc.set(source.bytes, value),
            inline .multi_slot, .single_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.set(source.bytes, &source.slots, value),
            inline .multi_slot_prebaked, .single_slot_prebaked => |acc| if (@hasField(S, "slots"))
                return try acc.set(&source.slots, value),
            .null => |acc| return try acc.set(value),
            else => {},
        }
        return error.InvalidOperation;
    }

    pub fn setElement(self: *const @This(), source: anytype, index: usize, value: *const Value) !void {
        const S = @TypeOf(source.*);
        switch (self.*) {
            .vector => |acc| if (@hasField(S, "bytes"))
                return try acc.set(source.bytes, index, value),
            .array_slot => |acc| if (@hasField(S, "bytes") and @hasField(S, "slots"))
                return try acc.set(source.bytes, &source.slots, index, value),
            else => {},
        }
        return error.InvalidOperation;
    }
};

pub fn WithBitOffset(comptime T: type, comptime bit_offset: ?u3) type {
    return if (bit_offset) |offset| define: {
        const fields: [2]std.builtin.Type.StructField = .{
            .{
                .name = "padding",
                .type = @Type(.{
                    .int = .{ .bits = offset, .signedness = .unsigned },
                }),
                .alignment = 0,
                .default_value_ptr = null,
                .is_comptime = false,
            },
            .{
                .name = "value",
                .type = T,
                .alignment = 0,
                .default_value_ptr = null,
                .is_comptime = false,
            },
        };
        break :define @Type(.{
            .@"struct" = .{
                .layout = .@"packed",
                .decls = &.{},
                .fields = &fields,
                .is_tuple = false,
            },
        });
    } else T;
}

pub fn read(entry: *Value, transform: ?Transform) !Value {
    if (transform) |t| {
        const obj = try php.getValueObject(entry);
        return switch (t) {
            .to_string => try invokeFunction(obj, "getString", .{}),
            .to_plain => try invokeFunction(obj, "getPlain", .{}),
            .to_value => try invokeFunction(obj, "readSelf", .{}),
        };
    } else {
        php.addRef(entry);
        return entry.*;
    }
}

pub fn write(entry: *Value, value: *const Value) Error!void {
    const obj = php.getValueObject(entry) catch unreachable;
    try invokeFunction(obj, "writeSelf", .{value});
}
