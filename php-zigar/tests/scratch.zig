const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub const Union = union(enum) {
    number1: i32,
    number2: i32,
    state: bool,
};

pub var some_union: Union = .{ .state = false };
