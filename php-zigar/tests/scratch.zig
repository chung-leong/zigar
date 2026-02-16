const std = @import("std");

pub const StructB = packed struct {
    number1: i2 = 1,
    number2: i137 = 12345678901234567890,
    state: bool = false,
};

pub var struct_b: StructB = .{};
