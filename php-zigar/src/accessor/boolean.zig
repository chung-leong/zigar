const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    use_bit_offset: bool = false,
};

pub fn Boolean(comptime attrs: Attributes) type {
    const T = bool;
    return switch (attrs.use_bit_offset) {
        false => struct {
            byte_offset: usize,
            comptime type: accessor.Type = .bool,
            comptime attributes: Attributes = attrs,

            pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
                const byte_size = (@bitSizeOf(T) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, false);
                const ptr: *align(1) T = @ptrCast(&bytes[self.byte_offset]);
                return php.createValueBool(ptr.*);
            }

            pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
                const byte_size = (@bitSizeOf(T) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
                if (self.byte_offset + byte_size > bytes.len) return error.OutOfBound;
                const ptr: *align(1) T = @ptrCast(&bytes[self.byte_offset]);
                ptr.* = switch (php.isValueNull(value)) {
                    false => try php.getValueBool(value),
                    true => false,
                };
            }
        },
        true => struct {
            byte_offset: usize,
            bit_offset: u3,
            comptime type: accessor.Type = .bool,
            comptime attributes: Attributes = attrs,

            pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
                return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |bit_offset| {
                    if (self.bit_offset == bit_offset) {
                        break try self.getAt(buffer, bit_offset);
                    }
                } else unreachable;
            }

            pub fn getAt(self: @This(), buffer: *ByteBuffer, comptime bit_offset: u3) Error!Value {
                // use a packed struct to access the boolean when there's a bit offset
                const AT = accessor.WithBitOffset(T, bit_offset);
                const byte_size = (@bitSizeOf(AT) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, false);
                const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
                return php.createValueBool(ptr.value);
            }

            pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
                inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |bit_offset| {
                    if (self.bit_offset == bit_offset) {
                        break try self.setAt(buffer, bit_offset, value);
                    }
                } else unreachable;
            }

            pub fn setAt(self: @This(), buffer: *ByteBuffer, comptime bit_offset: u3, value: *const Value) Error!void {
                const AT = accessor.WithBitOffset(T, bit_offset);
                const byte_size = (@bitSizeOf(AT) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
                if (self.byte_offset + byte_size > bytes.len) return error.OutOfBound;
                const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
                ptr.value = switch (php.isValueNull(value)) {
                    false => try php.getValueBool(value),
                    true => false,
                };
            }
        },
    };
}
