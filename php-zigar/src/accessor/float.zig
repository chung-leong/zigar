const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

const Attributes = struct {
    bit_offset: ?u3 = null,
    bit_size: usize,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .float = .{ .bits = self.bit_size },
        });
    }
};

pub fn Float(comptime attrs: Attributes) type {
    const T = attrs.Type();
    // use a packed struct to access the float when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    return struct {
        byte_offset: usize,
        comptime type: accessor.Type = .float,
        comptime attributes: Attributes = attrs,

        pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
            const byte_size = (@bitSizeOf(AT) + 7) / 8;
            const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, false);
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const float = if (comptime AT == T) ptr.* else ptr.value;
            return php.createValueDouble(@floatCast(float));
        }

        pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
            const byte_size = (@bitSizeOf(AT) + 7) / 8;
            const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const double = switch (php.isNull(value)) {
                false => try php.getValueDouble(value),
                true => 0.0,
            };
            if (comptime AT == T) ptr.* = @floatCast(double) else ptr.value = @floatCast(double);
        }
    };
}
