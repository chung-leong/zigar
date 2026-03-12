const std = @import("std");

pub const StructA = packed struct {
    state: bool = false,
    number1: f16 = 1,
    number2: f64 = 2,
    number3: f32 = 3,
};

pub var struct_a: StructA = .{ .state = true, .number1 = 1.5, .number2 = 7.77, .number3 = -4.25 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
