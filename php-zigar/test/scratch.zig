const std = @import("std");

pub const StructA = packed struct {
    flag1: bool = true,
    flag2: bool = true,
    flag3: bool = false,
    flga4: bool = true,
};

pub var struct_a: StructA = .{};
