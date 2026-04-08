const std = @import("std");

pub const Struct = struct {
    number1: i32 = 1234,
    number2: i32 = 4567,
};
pub const something: Struct = .{};
