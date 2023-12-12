const std = @import("std");

pub const StructA = struct {
    number1: comptime_int = 100,
    number2: comptime_int = 200,
};

pub const struct_a: StructA = .{ .number1 = 1, .number2 = 2 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
