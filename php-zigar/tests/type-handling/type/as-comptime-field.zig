const std = @import("std");

pub const StructA = struct {
    number: i32,
    comptime Type: type = bool,
};

pub const struct_a: StructA = .{ .number = 123 };
