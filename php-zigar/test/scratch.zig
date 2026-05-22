const std = @import("std");

pub const A = struct {
    number1: usize,
    number2: usize,
    b: struct {
        number3: usize = 777,
    } = .{},
};

pub const a: A = .{ .number1 = 123, .number2 = 456 };
pub const array: [4]i32 = .{ 1, 2, 3, 4 };
