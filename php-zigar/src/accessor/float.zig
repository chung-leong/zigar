const std = @import("std");

const accessor = @import("../accessor.zig");
const Primitive = accessor.Primitive;
const Error = accessor.Error;
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    bit_offset: ?u3,
    bit_size: usize,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .float = .{ .bits = self.bit_size },
        });
    }
};

pub fn get(comptime attrs: Attributes) Primitive {
    const T = attrs.Type();
    // use a packed struct to access the float when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    const ns = struct {
        fn get(self: *const Primitive, buffer: *ByteBuffer) Error!Value {
            const bytes: []u8 = buffer.bytes;
            if (self.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const float = if (comptime AT == T) ptr.* else ptr.value;
            return php.createValueDouble(@floatCast(float));
        }

        fn set(self: *const Primitive, buffer: *ByteBuffer, value: *Value) Error!void {
            const bytes: []u8 = buffer.bytes;
            if (self.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const double = try php.getValueDouble(value);
            if (comptime AT == T) ptr.* = @floatCast(double) else ptr.value = @floatCast(double);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set };
}
