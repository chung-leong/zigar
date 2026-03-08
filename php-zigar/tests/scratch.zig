const std = @import("std");

pub const U = union(enum) {
    number1: i32,
    number2: i32,
};

pub var something: [4]U = .{
    .{ .number1 = 1 },
    .{ .number2 = 2 },
    .{ .number1 = 3 },
    .{ .number2 = 4 },
};
