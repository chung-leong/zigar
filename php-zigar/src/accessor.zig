const std = @import("std");

pub const boolean = @import("accessor/boolean.zig");
pub const float = @import("accessor/float.zig");
pub const int = @import("accessor/int.zig");
pub const object = @import("accessor/object.zig");
pub const prebaked = @import("accessor/prebaked.zig");
pub const vector = @import("accessor/vector.zig");
const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const ClassEntry = php.ClassEntry;

pub const Error = error{
    CannotCreateObject,
    OutOfBound,
    OutOfMemory,
    Missing,
    NotBoolean,
    NotInteger,
    NotDouble,
    NotString,
};

pub const Primitive = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer) Error!Value {
        return try self.getter(self, buffer);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, value: *Value) Error!void {
        return try self.setter(self, buffer, value);
    }
};

pub const Vector = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {};
    pub const Getter = fn (*const @This(), *ByteBuffer, usize) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, usize, *Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, index: usize) Error!Value {
        return try self.getter(self, buffer, index);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, index: usize, value: *Value) Error!void {
        return try self.setter(self, buffer, index, value);
    }
};

pub const Object = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        byte_offset: usize = undefined,
        byte_size: usize,
        slot: usize,
        class_entry: *ClassEntry,
    };
    pub const Getter = fn (*const @This(), *ByteBuffer, *HashTable) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *HashTable, *Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *HashTable) Error!Value {
        return try self.getter(self, buffer, slots);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *HashTable, value: *Value) Error!void {
        return try self.setter(self, buffer, slots, value);
    }
};

pub const Prebaked = struct {
    params: Parameters,
    getter: *const Getter,
    setter: *const Setter,

    pub const Parameters = struct {
        slot: usize,
    };
    pub const Getter = fn (*const @This(), *HashTable) Error!Value;
    pub const Setter = fn (*const @This(), *HashTable, *Value) Error!void;

    pub fn get(self: *const @This(), slots: *HashTable) Error!Value {
        return try self.getter(self, slots);
    }

    pub fn set(self: *const @This(), slots: *HashTable, value: *Value) Error!void {
        return try self.setter(self, slots, value);
    }
};

pub const Any = union(enum) {
    primitive: Primitive,
    object: Object,
    vector: Vector,
    prebaked: Prebaked,
    missing: void,
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
