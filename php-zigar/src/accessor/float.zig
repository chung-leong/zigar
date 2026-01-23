const std = @import("std");

const accessor = @import("../accessor.zig");
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

pub fn get(comptime attrs: Attributes, params: accessor.Primitive.Parameters) accessor.Primitive {
    const T = attrs.Type();
    // use a packed struct to access the float when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    const ns = struct {
        pub fn get(acc: *const accessor.Primitive, buffer: *ByteBuffer) Error!Value {
            const bytes: []u8 = buffer.bytes;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const float = if (comptime AT == T) ptr.* else ptr.value;
            return php.createValueDouble(@floatCast(float));
        }

        pub fn set(acc: *const accessor.Primitive, buffer: *ByteBuffer, value: *const Value) Error!void {
            const bytes: []u8 = buffer.bytes;
            if (buffer.is_read_only) return error.WriteProtected;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const double = try php.getValueDouble(value);
            if (comptime AT == T) ptr.* = @floatCast(double) else ptr.value = @floatCast(double);
        }

        pub fn stringify(acc: *const accessor.Primitive, buffer: *ByteBuffer) Error!Value {
            const bytes: []u8 = buffer.bytes;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const float = if (comptime AT == T) ptr.* else ptr.value;
            var buf: [64]u8 = undefined;
            const str = std.fmt.bufPrint(&buf, "{d}", .{float}) catch unreachable;
            return php.createValueStringContent(str);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .stringifier = &ns.stringify, .params = params };
}
