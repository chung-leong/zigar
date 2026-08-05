const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const Error = @import("../failure.zig").Error;
const php = @import("../php.zig");
const Value = php.Value;

fn Arg(comptime func: anytype) type {
    const T = @TypeOf(func);
    const info = @typeInfo(T).@"fn";
    return info.params[0].type.?;
}

const Attributes = union(enum) {
    bool: Arg(accessor.Boolean),
    int: Arg(accessor.Int),
    gmp: Arg(accessor.Gmp),
    float: Arg(accessor.Float),

    pub fn bitSize(comptime self: @This(), is_packed: bool) usize {
        const T = switch (self) {
            .bool => bool,
            .int => |int| @Type(.{
                .int = .{ .bits = int.bit_size, .signedness = int.signedness },
            }),
            .gmp => return null,
            .float => |float| @Type(.{
                .float = .{ .bits = float.bit_size },
            }),
        };
        return if (is_packed) @bitSizeOf(T) else @sizeOf(T) * 8;
    }

    pub fn Primitive(comptime self: @This(), comptime use_bit_offset: bool) type {
        const p_attrs = switch (self) {
            inline else => |a| add: {
                var attrs = a;
                attrs.use_bit_offset = use_bit_offset;
                break :add attrs;
            },
        };
        return switch (self) {
            .bool => accessor.Boolean(p_attrs),
            .int => accessor.Int(p_attrs),
            .gmp => accessor.Gmp(p_attrs),
            .float => accessor.Float(p_attrs),
        };
    }
};

pub fn Vector(comptime attrs: Attributes) type {
    if (comptime attrs != .gmp) {
        return struct {
            runtime_check: bool,
            comptime type: accessor.Type = .vector,
            comptime attributes: Attributes = attrs,

            pub fn getElement(self: @This(), buffer: *ByteBuffer, index: usize) Error!Value {
                const is_packed = buffer.flags.contains_packed_data;
                const bit_size = attrs.bitSize(is_packed);
                const bit_index = index * bit_size;
                const byte_index = bit_index / 8;
                if (is_packed) {
                    const bit_offset = (buffer.bit_offset + bit_index) % 8;
                    const p_acc = self.primitiveAt(byte_index, true);
                    return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            break try p_acc.getAt(buffer, possible_offset);
                        }
                    } else unreachable;
                } else {
                    const p_acc = self.primitiveAt(byte_index, false);
                    return try p_acc.get(buffer);
                }
            }

            pub fn setElement(self: @This(), buffer: *ByteBuffer, index: usize, value: *const Value) Error!void {
                const is_packed = buffer.flags.contains_packed_data;
                const bit_size = attrs.bitSize(is_packed);
                const bit_index = index * bit_size;
                const byte_index = bit_index / 8;
                if (is_packed) {
                    const bit_offset = (buffer.bit_offset + bit_index) % 8;
                    const p_acc = self.primitiveAt(byte_index, true);
                    return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            break try p_acc.setAt(buffer, possible_offset, value);
                        }
                    } else unreachable;
                } else {
                    const p_acc = self.primitiveAt(byte_index, false);
                    return try p_acc.set(buffer, value);
                }
            }

            fn primitiveAt(self: @This(), byte_offset: usize, comptime use_bit_offset: bool) attrs.Primitive(use_bit_offset) {
                const P = attrs.Primitive(use_bit_offset);
                var acc: P = undefined;
                acc.byte_offset = byte_offset;
                if (@hasField(P, "runtime_check")) acc.runtime_check = self.runtime_check;
                return acc;
            }
        };
    } else {
        return struct {
            // gmp accessors don't have comptime known bit size
            bit_size: usize = 0,
            runtime_check: bool,
            comptime type: accessor.Type = .vector,
            comptime attributes: Attributes = attrs,

            pub fn getElement(self: @This(), buffer: *ByteBuffer, index: usize) Error!Value {
                const is_packed = buffer.flags.contains_packed_data;
                const bit_index = index * self.bit_size;
                const byte_index = bit_index / 8;
                if (is_packed) {
                    const bit_offset = bit_index % 8;
                    const p_acc = self.primitiveAt(byte_index, true);
                    return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            return try p_acc.getAt(buffer, possible_offset);
                        }
                    } else unreachable;
                } else {
                    const p_acc = self.primitiveAt(byte_index, false);
                    return try p_acc.get(buffer);
                }
            }

            pub fn setElement(self: @This(), buffer: *ByteBuffer, index: usize, value: *const Value) Error!void {
                const is_packed = buffer.flags.contains_packed_data;
                const bit_index = index * self.bit_size;
                const byte_index = bit_index / 8;
                if (is_packed) {
                    const bit_offset = bit_index % 8;
                    const p_acc = self.primitiveAt(byte_index, true);
                    inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                        if (bit_offset == possible_offset) {
                            return try p_acc.setAt(buffer, possible_offset, value);
                        }
                    } else unreachable;
                } else {
                    const p_acc = self.primitiveAt(byte_index, false);
                    return try p_acc.set(buffer, value);
                }
            }

            fn primitiveAt(self: @This(), byte_offset: usize, comptime use_bit_offset: bool) attrs.Primitive(use_bit_offset) {
                const P = attrs.Primitive(use_bit_offset);
                var acc: P = undefined;
                acc.byte_offset = byte_offset;
                acc.bit_size = self.bit_size;
                if (@hasField(P, "runtime_check")) acc.runtime_check = self.runtime_check;
                return acc;
            }
        };
    }
}
