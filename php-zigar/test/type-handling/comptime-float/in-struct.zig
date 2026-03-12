const std = @import("std");

pub const StructA = struct {
    number1: comptime_float = 0.1,
    number2: comptime_float = 0.2,
};

pub const struct_a: StructA = .{ .number1 = 1.1, .number2 = 2.2 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
