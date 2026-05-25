const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const failure = @import("../failure.zig");
const php = @import("../php.zig");
const Value = php.Value;

const Attributes = struct {
    bit_size: usize,
    use_bit_offset: bool = false,

    pub fn Type(self: @This()) type {
        return @Type(.{
            .float = .{ .bits = self.bit_size },
        });
    }
};

pub fn Float(comptime attrs: Attributes) type {
    const T = attrs.Type();
    return switch (attrs.use_bit_offset) {
        false => struct {
            byte_offset: usize,
            runtime_check: bool,
            comptime type: accessor.Type = .float,
            comptime attributes: Attributes = attrs,

            pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
                const byte_size = (@bitSizeOf(T) + 7) / 8;
                const bytes: []const u8 = try buffer.data(self.byte_offset + byte_size, false);
                const ptr: *align(1) const T = @ptrCast(&bytes[self.byte_offset]);
                return php.createValueDouble(@floatCast(ptr.*));
            }

            pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
                const double = try php.getValueDouble(value);
                if (self.runtime_check) try check(T, double);
                const byte_size = (@bitSizeOf(T) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
                const ptr: *align(1) T = @ptrCast(&bytes[self.byte_offset]);
                ptr.* = @floatCast(double);
            }
        },
        true => struct {
            byte_offset: usize,
            bit_offset: u3,
            runtime_check: bool,
            comptime type: accessor.Type = .float,
            comptime attributes: Attributes = attrs,

            pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
                const bit_offset = buffer.bit_offset +% self.bit_offset;
                return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                    if (bit_offset == possible_offset) {
                        break try self.getAt(buffer, possible_offset);
                    }
                } else unreachable;
            }

            pub fn getAt(self: @This(), buffer: *ByteBuffer, comptime bit_offset: u3) Error!Value {
                // use a packed struct to access the float when there's a bit offset
                const AT = accessor.WithBitOffset(T, bit_offset);
                const byte_size = (@bitSizeOf(AT) + 7) / 8;
                const bytes: []const u8 = try buffer.data(self.byte_offset + byte_size, false);
                const ptr: *align(1) const AT = @ptrCast(&bytes[self.byte_offset]);
                return php.createValueDouble(@floatCast(ptr.value));
            }

            pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
                const bit_offset = buffer.bit_offset +% self.bit_offset;
                inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                    if (bit_offset == possible_offset) {
                        break try self.setAt(buffer, possible_offset, value);
                    }
                } else unreachable;
            }

            pub fn setAt(self: @This(), buffer: *ByteBuffer, comptime bit_offset: u3, value: *const Value) Error!void {
                const double = try php.getValueDouble(value);
                if (self.runtime_check) try check(T, double);
                const AT = accessor.WithBitOffset(T, bit_offset);
                const byte_size = (@bitSizeOf(AT) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
                const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
                ptr.value = @floatCast(double);
            }
        },
    };
}

fn check(comptime T: type, value: f64) error{Unexpected}!void {
    if (value < std.math.floatMin(T) or value > std.math.floatMax(T)) {
        return failure.report("{s} cannot represent the value given: {d}", .{ @typeName(T), value });
    }
}
