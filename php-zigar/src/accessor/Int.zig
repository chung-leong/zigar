const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const Error = @import("../failure.zig").Error;
const php_ng = @import("../php/root.zig");
const failure = php_ng.failure;
const Value = php_ng.Value;

pub fn @"fn"(comptime attrs: Attributes) type {
    @setEvalBranchQuota(2000000);
    const T = attrs.Type();
    return switch (attrs.use_bit_offset) {
        false => struct {
            pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
                const byte_size = (@bitSizeOf(T) + 7) / 8;
                const bytes: []const u8 = try buffer.data(self.byte_offset + byte_size, false);
                if (comptime @bitSizeOf(T) == 0) return .fromInteger(0);
                const ptr: *align(1) const T = @ptrCast(&bytes[self.byte_offset]);
                return switch (@typeInfo(T).int.signedness) {
                    .signed => .fromInteger(ptr.*),
                    .unsigned => .fromUnsigned(ptr.*),
                };
            }

            pub fn set(self: @This(), buffer: *ByteBuffer, value: Value) Error!void {
                const number = try .getInteger(value);
                if (self.runtime_check) try check(T, number);
                const byte_size = (@bitSizeOf(T) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
                if (comptime @bitSizeOf(T) == 0) return;
                const ptr: *align(1) T = @ptrCast(&bytes[self.byte_offset]);
                ptr.* = switch (attrs.signedness) {
                    .signed => @truncate(number),
                    .unsigned => @truncate(@as(c_ulong, @bitCast(number))),
                };
            }

            byte_offset: usize,
            runtime_check: bool,
            comptime type: accessor.Type = .int,
            comptime attributes: Attributes = attrs,
        },
        true => struct {
            pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
                const bit_offset = buffer.bit_offset +% self.bit_offset;
                return inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                    if (bit_offset == possible_offset) {
                        break try self.getAt(buffer, possible_offset);
                    }
                } else unreachable;
            }

            pub fn getAt(self: @This(), buffer: *ByteBuffer, comptime bit_offset: u3) Error!Value {
                // use a packed struct to access the boolean when there's a bit offset
                const AT = accessor.WithBitOffset(T, bit_offset);
                const byte_size = (@bitSizeOf(AT) + 7) / 8;
                const bytes: []const u8 = try buffer.data(self.byte_offset + byte_size, false);
                if (comptime @bitSizeOf(T) == 0) return .fromInteger(0);
                const ptr: *align(1) const AT = @ptrCast(&bytes[self.byte_offset]);
                return switch (@typeInfo(T).int.signedness) {
                    .signed => .fromInteger(ptr.value),
                    .unsigned => .fromUnsigned(ptr.value),
                };
            }

            pub fn set(self: @This(), buffer: *ByteBuffer, value: Value) Error!void {
                const bit_offset = buffer.bit_offset +% self.bit_offset;
                inline for (.{ 0, 1, 2, 3, 4, 5, 6, 7 }) |possible_offset| {
                    if (bit_offset == possible_offset) {
                        break try self.setAt(buffer, possible_offset, value);
                    }
                } else unreachable;
            }

            pub fn setAt(self: @This(), buffer: *ByteBuffer, comptime bit_offset: u3, value: Value) Error!void {
                const number = try .getInteger(value);
                if (self.runtime_check) try check(T, number);
                const AT = accessor.WithBitOffset(T, bit_offset);
                const byte_size = (@bitSizeOf(AT) + 7) / 8;
                const bytes: []u8 = try buffer.data(self.byte_offset + byte_size, true);
                if (comptime @bitSizeOf(T) == 0) return;
                const ptr: *align(1) AT = @ptrCast(&bytes[self.byte_offset]);
                ptr.value = switch (attrs.signedness) {
                    .signed => @truncate(number),
                    .unsigned => @truncate(@as(c_long, @bitCast(number))),
                };
            }

            byte_offset: usize,
            bit_offset: u3,
            runtime_check: bool,
            comptime type: accessor.Type = .int,
            comptime attributes: Attributes = attrs,
        },
    };
}

fn check(comptime T: type, value: c_long) error{FailureReported}!void {
    if (value < std.math.minInt(T) or value > std.math.maxInt(T)) {
        return failure.report("{s} cannot represent the value given: {d}", .{ @typeName(T), value });
    }
}

const Attributes = struct {
    signedness: std.builtin.Signedness,
    bit_size: usize,
    use_bit_offset: bool = false,

    pub fn Type(self: @This()) type {
        return @Int(self.signedness, self.bit_size);
    }
};
