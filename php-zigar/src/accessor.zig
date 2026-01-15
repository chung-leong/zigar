const std = @import("std");

pub const boolean = @import("accessor/boolean.zig");
pub const float = @import("accessor/float.zig");
pub const int = @import("accessor/int.zig");
pub const vector = @import("accessor/vector.zig");
const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const zig_class = @import("zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub const Error = error{
    OutOfBound,
    MissingSlots,
    NotBoolean,
    NotInteger,
    NotDouble,
    NotString,
};

pub const Primitive = struct {
    byte_offset: usize = undefined,
    getter: *const Getter,
    setter: *const Setter,

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
    getter: *const Getter,
    setter: *const Setter,

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
    byte_size: usize,
    slot: usize,
    class: ZigClass,
    getter: *const Getter,
    setter: *const Setter,

    pub const Getter = fn (*const @This(), *ByteBuffer, *HashTable, ?**anyopaque) Error!Value;
    pub const Setter = fn (*const @This(), *ByteBuffer, *HashTable, ?**anyopaque, *Value) Error!void;

    pub fn get(self: *const @This(), buffer: *ByteBuffer, slots: *HashTable, cache_slot: ?**anyopaque) Error!Value {
        return try self.getter(self, buffer, slots, cache_slot);
    }

    pub fn set(self: *const @This(), buffer: *ByteBuffer, slots: *HashTable, value: *Value, cache_slot: ?**anyopaque) Error!void {
        return try self.setter(self, buffer, slots, value, cache_slot);
    }
};

pub const Any = union(enum) {
    primitive: Primitive,
    object: Object,
    vector: Vector,
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
