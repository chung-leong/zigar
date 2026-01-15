const std = @import("std");

pub const boolean = @import("accessor/boolean.zig");
pub const float = @import("accessor/float.zig");
pub const int = @import("accessor/int.zig");
pub const vector = @import("accessor/vector.zig");
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
    get: *const Getter,
    set: *const Setter,

    pub const Getter = fn (@This(), []u8) Error!Value;
    pub const Setter = fn (@This(), []u8, *Value) Error!void;
};

pub const Vector = struct {
    get: *const Getter,
    set: *const Setter,

    pub const Getter = fn (@This(), []u8, usize) Error!Value;
    pub const Setter = fn (@This(), []u8, usize, *Value) Error!void;
};

pub const Object = struct {
    byte_size: usize,
    slot: usize,
    class: ZigClass,
    get: *const Getter,
    set: *const Setter,

    pub const Getter = fn (@This(), []u8, *HashTable, **anyopaque) Error!Value;
    pub const Setter = fn (@This(), []u8, *HashTable, **anyopaque, *Value) Error!void;
};

pub const Any = union(enum) {
    primitive: Primitive,
    object: Object,
    vector: Vector,
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
