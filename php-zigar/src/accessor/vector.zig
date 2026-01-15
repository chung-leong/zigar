const std = @import("std");

const accessor = @import("../accessor.zig");
const Primitive = accessor.Primitive;
const Vector = accessor.Vector;
const Error = accessor.Error;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    child: type,
    is_packed: bool = false,
};

fn getPrimitiveAccessor(comptime T: type, comptime bit_offset: ?u3, byte_offset: usize) Primitive {
    var accessors = switch (@typeInfo(T)) {
        .bool => accessor.boolean.get(.{
            .bit_offset = bit_offset,
        }),
        .int => |int| accessor.int.get(.{
            .signedness = int.signedness,
            .bit_size = int.bits,
            .bit_offset = bit_offset,
        }),
        .float => |float| accessor.float.get(.{
            .bit_size = float.bits,
            .bit_offset = bit_offset,
        }),
        else => @compileError("Not a primitive type: " ++ @typeName(T)),
    };
    accessors.byte_offset = byte_offset;
    return accessors;
}

fn possibleRemainders(bit_size: usize) [8 / std.math.gcd(bit_size, 8)]u8 {
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

pub fn get(comptime attrs: Attributes) Vector {
    const T = attrs.child;

    const ns = struct {
        fn get(_: Vector, bytes: []u8, index: usize) Error!Value {
            if (comptime @bitSizeOf(T) == 0) return php.createValueLong(0);
            if (attrs.is_packed) {
                const bit_index = index * @bitSizeOf(T);
                const bit_offset = bit_index % 8;
                return inline for (comptime possibleRemainders(@bitSizeOf(T))) |possible_offset| {
                    if (bit_offset == possible_offset) {
                        var primitive = getPrimitiveAccessor(T, possible_offset, bit_index / 8);
                        break try primitive.get(primitive, bytes);
                    }
                } else unreachable;
            } else {
                var primitive = getPrimitiveAccessor(T, null, index * @sizeOf(T));
                return try primitive.get(primitive, bytes);
            }
        }

        fn set(_: Vector, bytes: []u8, index: usize, value: *Value) Error!void {
            if (comptime @bitSizeOf(T) == 0) return;
            if (attrs.is_packed) {
                const bit_index = index * @bitSizeOf(T);
                const bit_offset = bit_index % 8;
                return inline for (comptime possibleRemainders(@bitSizeOf(T))) |possible_offset| {
                    if (bit_offset == possible_offset) {
                        var primitive = getPrimitiveAccessor(T, possible_offset, bit_index / 8);
                        break try primitive.set(primitive, bytes, value);
                    }
                } else unreachable;
            } else {
                var primitive = getPrimitiveAccessor(T, null, index * @sizeOf(T));
                return try primitive.set(primitive, bytes, value);
            }
        }
    };
    return .{ .get = &ns.get, .set = &ns.set };
}
