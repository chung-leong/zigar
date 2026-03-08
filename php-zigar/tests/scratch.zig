const std = @import("std");

pub const U = union(enum) {
    number1: i32,
    number2: i32,
};

pub var something: U = .{ .number1 = 1 };
