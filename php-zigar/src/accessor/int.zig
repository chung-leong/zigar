const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    signedness: std.builtin.Signedness,
    bit_offset: ?u3 = null,
    bit_size: usize = 0,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .int = .{ .bits = self.bit_size, .signedness = self.signedness },
        });
    }
};

pub fn get(comptime attrs: Attributes, params: accessor.Primitive.Parameters) accessor.Primitive {
    const T = attrs.Type();
    // use a packed struct to access the int when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    const ns = struct {
        pub fn get(acc: *const accessor.Primitive, buffer: *ByteBuffer) Error!Value {
            if (comptime @bitSizeOf(T) == 0) return php.createValueLong(0);
            const bytes: []u8 = buffer.bytes;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const int = if (comptime AT == T) ptr.* else ptr.value;
            const value = php.createValueAnyInt(int);
            return if (acc.params.transform) |t| try t.toValue(&value) else value;
        }

        pub fn set(acc: *const accessor.Primitive, buffer: *ByteBuffer, value: *const Value) Error!void {
            if (comptime @bitSizeOf(T) == 0) return;
            const bytes: []u8 = buffer.bytes;
            if (buffer.is_read_only) return error.WriteProtected;
            if (acc.params.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[acc.params.byte_offset]);
            const int: T = switch (php.isNull(value)) {
                false => get: {
                    const int_value = if (acc.params.transform) |t| transform: {
                        const int_bytes = try t.fromValue(value);
                        const int_acc: accessor.Primitive = .{
                            .params = .{ .byte_offset = 0 },
                            .getter = undefined,
                            .setter = undefined,
                        };
                        const transformed_value = try @This().get(&int_acc, int_bytes);
                        break :transform &transformed_value;
                    } else value;
                    const long = try php.getValueLong(int_value);
                    break :get switch (attrs.signedness) {
                        .signed => @truncate(long),
                        .unsigned => @truncate(@as(c_ulong, @bitCast(long))),
                    };
                },
                true => 0,
            };
            if (comptime AT == T) ptr.* = int else ptr.value = int;
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}
