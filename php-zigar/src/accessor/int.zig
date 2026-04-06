const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const php = @import("../php.zig");
const Value = php.Value;

const Attributes = struct {
    signedness: std.builtin.Signedness,
    bit_offset: ?u3 = null,
    bit_size: usize,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .int = .{ .bits = self.bit_size, .signedness = self.signedness },
        });
    }
};

pub fn Int(comptime attrs: Attributes) type {
    @setEvalBranchQuota(2000000);
    const T = attrs.Type();
    // use a packed struct to access the int when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    return struct {
        byte_offset: usize,
        comptime type: accessor.Type = .int,
        comptime attributes: Attributes = attrs,

        pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
            const byte_size = (@bitSizeOf(AT) + 7) / 8;
            const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, false);
            if (comptime @bitSizeOf(T) == 0) return php.createValueLong(0);
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const int = if (comptime AT == T) ptr.* else ptr.value;
            const value = php.createValueAnyInt(int);
            return value;
        }

        pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
            const byte_size = (@bitSizeOf(AT) + 7) / 8;
            const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
            if (comptime @bitSizeOf(T) == 0) return;
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const int: T = switch (php.isNull(value)) {
                false => get: {
                    const long = try php.getValueLong(value);
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
}
