const std = @import("std");

pub const A = struct {
    number1: usize,
    number2: usize,
};

pub const a: A = .{ .number1 = 1, .number2 = 2 };
