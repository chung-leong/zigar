const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    bit_offset: ?u3 = null,
};

pub fn Boolean(comptime attrs: Attributes) type {
    const T = bool;
    // use a packed struct to access the boolean when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    return struct {
        byte_offset: usize,
        bit_size: usize = 0,
        comptime type: accessor.Type = .bool,
        comptime attributes: Attributes = attrs,

        pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
            const byte_size = (@bitSizeOf(AT) + 7) / 8;
            const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, false);
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const boolean = if (comptime AT == T) ptr.* else ptr.value;
            return php.createValueBool(boolean);
        }

        pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
            const byte_size = (@bitSizeOf(AT) + 7) / 8;
            const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
            if (self.byte_offset + byte_size > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const boolean = switch (php.isNull(value)) {
                false => try php.getValueBool(value),
                true => false,
            };
            if (comptime AT == T) ptr.* = boolean else ptr.value = boolean;
        }
    };
}
