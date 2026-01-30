const std = @import("std");

pub const StructA = struct {
    number1: f32 = 123,
    number2: f64 = 0.456,
};

pub var struct_a: StructA = .{ .number1 = -0.5, .number2 = -4.44 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
