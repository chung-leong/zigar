const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    child: union(enum) {
        bool: accessor.boolean.Attributes,
        int: accessor.int.Attributes,
        gmp: accessor.gmp.Attributes,
        float: accessor.float.Attributes,
        void: accessor.void.Attributes,
    },
    is_packed: bool = false,

    pub fn bitSize(self: *const @This()) ?usize {
        return switch (self.child) {
            .bool => if (self.is_packed) @bitSizeOf(bool) else @sizeOf(bool) * 8,
            .int => |int| int.bit_size,
            .gmp => null,
            .float => |float| float.bit_size,
            .void => 0,
        };
    }
};

fn getPrimitiveAccessors(comptime attrs: Attributes, comptime bit_offset: ?u3) accessor.Primitive {
    return switch (attrs.child) {
        .bool => accessor.boolean.get(.{
            .bit_offset = bit_offset,
        }, undefined),
        .int => |int| accessor.int.get(.{
            .signedness = int.signedness,
            .bit_size = int.bit_size,
            .bit_offset = bit_offset,
        }, undefined),
        .gmp => |gmp| accessor.gmp.get(.{
            .signedness = gmp.signedness,
            .bit_offset = bit_offset,
        }, undefined),
        .float => |float| accessor.float.get(.{
            .bit_size = float.bit_size,
            .bit_offset = bit_offset,
        }, undefined),
        .void => accessor.void.get(.{}, undefined),
    };
}

fn getPrimitive(comptime attrs: Attributes, comptime bit_offset: ?u3, bytes: *ByteBuffer, byte_offset: usize) !Value {
    // devirtualize the operation by obtaining the getter at comptime
    const acc_ct = comptime getPrimitiveAccessors(attrs, bit_offset);
    const acc: accessor.Primitive = .{
        .params = .{ .byte_offset = byte_offset },
        .getter = undefined,
        .setter = undefined,
    };
    return acc_ct.getter(&acc, bytes);
}

fn getPrimitiveWithSize(comptime attrs: Attributes, comptime bit_offset: ?u3, bytes: *ByteBuffer, byte_offset: usize, bit_size: usize) !Value {
    // devirtualize the operation by obtaining the getter at comptime
    const acc_ct = comptime getPrimitiveAccessors(attrs, bit_offset);
    const acc: accessor.Primitive = .{
        .params = .{ .byte_offset = byte_offset, .bit_size = bit_size },
        .getter = undefined,
        .setter = undefined,
    };
    return acc_ct.getter(&acc, bytes);
}

fn setPrimitive(comptime attrs: Attributes, comptime bit_offset: ?u3, bytes: *ByteBuffer, byte_offset: usize, value: *const Value) !void {
    const acc_ct = comptime getPrimitiveAccessors(attrs, bit_offset);
    const acc: accessor.Primitive = .{
        .params = .{ .byte_offset = byte_offset },
        .getter = undefined,
        .setter = undefined,
    };
    return acc_ct.setter(&acc, bytes, value);
}

fn setPrimitiveWithSize(comptime attrs: Attributes, comptime bit_offset: ?u3, bytes: *ByteBuffer, byte_offset: usize, bit_size: usize, value: *const Value) !void {
    const acc_ct = comptime getPrimitiveAccessors(attrs, bit_offset);
    const acc: accessor.Primitive = .{
        .params = .{ .byte_offset = byte_offset, .bit_size = bit_size },
        .getter = undefined,
        .setter = undefined,
    };
    return acc_ct.setter(&acc, bytes, value);
}

fn possibleRemainders(comptime bit_size: usize) [8 / std.math.gcd(bit_size, 8)]u3 {
    const gcd = std.math.gcd(bit_size, 8);
    var remainders: [8 / gcd]u3 = undefined;
    var n: usize = 0;
    var i: usize = 0;
    while (n < 8) : (i += 1) {
        remainders[i] = @intCast(n);
        n += gcd;
    }
    return remainders;
}

pub fn get(comptime attrs: Attributes, params: accessor.Vector.Parameters) accessor.Vector {
    const ns = struct {
        pub fn get(acc: *const accessor.Vector, buffer: *ByteBuffer, index: usize) Error!Value {
            if (comptime attrs.bitSize()) |bit_size| {
                if (bit_size == 0) return php.createValueLong(0);
                const bit_index = index * bit_size;
                const byte_index = bit_index / 8;
                if (attrs.is_packed) {
                    const bit_offset = bit_index % 8;
                    return inline for (comptime possibleRemainders(bit_size)) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            break try getPrimitive(attrs, possible_offset, buffer, byte_index);
                        }
                    } else unreachable;
                } else {
                    return try getPrimitive(attrs, null, buffer, byte_index);
                }
            } else {
                // gmp accessors don't have comptime known bit size
                const bit_size = acc.params.bit_size;
                const bit_index = index * bit_size;
                const byte_index = bit_index / 8;
                if (attrs.is_packed) {
                    const bit_offset = bit_index % 8;
                    return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            break try getPrimitiveWithSize(attrs, possible_offset, buffer, byte_index, bit_size);
                        }
                    } else unreachable;
                } else {
                    return try getPrimitiveWithSize(attrs, null, buffer, byte_index, bit_size);
                }
            }
        }

        pub fn set(acc: *const accessor.Vector, buffer: *ByteBuffer, index: usize, value: *const Value) Error!void {
            if (comptime attrs.bitSize()) |bit_size| {
                if (bit_size == 0) return;
                const bit_index = index * bit_size;
                const byte_index = bit_index / 8;
                if (attrs.is_packed) {
                    const bit_offset = bit_index % 8;
                    return inline for (comptime possibleRemainders(bit_size)) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            break try setPrimitive(attrs, possible_offset, buffer, byte_index, value);
                        }
                    } else unreachable;
                } else {
                    return try setPrimitive(attrs, null, buffer, byte_index, value);
                }
            } else {
                const bit_size = acc.params.bit_size;
                const bit_index = index * bit_size;
                const byte_index = bit_index / 8;
                if (attrs.is_packed) {
                    const bit_offset = bit_index % 8;
                    return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            break try setPrimitiveWithSize(attrs, possible_offset, buffer, byte_index, bit_size, value);
                        }
                    } else unreachable;
                } else {
                    return try setPrimitiveWithSize(attrs, null, buffer, byte_index, bit_size, value);
                }
            }
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
