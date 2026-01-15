const std = @import("std");

const accessor = @import("../accessor.zig");
const Primitive = accessor.Primitive;
const Error = accessor.Error;
const php = @import("../php.zig");
const Value = php.Value;

pub const Attributes = struct {
    signedness: std.builtin.Signedness,
    bit_offset: ?u3,
    bit_size: usize,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .int = .{ .bits = self.bit_size, .signedness = self.signedness },
        });
    }
};

pub fn get(comptime attrs: Attributes) Primitive {
    const T = attrs.Type();
    // use a packed struct to access the int when there's a bit offset
    const AT = accessor.WithBitOffset(T, attrs.bit_offset);
    const ns = struct {
        fn get(self: Primitive, bytes: []u8) Error!Value {
            if (comptime @bitSizeOf(T) == 0) return php.createValueLong(0);
            if (self.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const int = if (comptime AT == T) ptr.* else ptr.value;
            return php.createValueAnyInt(int);
        }

        fn set(self: Primitive, bytes: []u8, value: *Value) Error!void {
            if (comptime @bitSizeOf(T) == 0) return;
            if (self.byte_offset + @sizeOf(AT) > bytes.len) return error.OutOfBound;
            const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
            const long = try php.getValueLong(value);
            const int: T = switch (attrs.signedness) {
                .signed => @truncate(long),
                .unsigned => @truncate(@as(c_ulong, @bitCast(long))),
            };
            if (comptime AT == T) ptr.* = int else ptr.value = int;
        }
    };
    return .{ .get = &ns.get, .set = &ns.set };
}
