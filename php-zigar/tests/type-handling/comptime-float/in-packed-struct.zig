const std = @import("std");

pub const StructA = packed struct {
    state: bool = false,
    number1: comptime_float = 100,
    number2: comptime_float = 200,
    number3: comptime_float = 300,
};

pub var struct_a: StructA = .{ .state = true, .number1 = 1, .number2 = 2, .number3 = 3 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
