const std = @import("std");

pub const StructA = struct {
    number: i32,
    comptime empty: noreturn = unreachable,
};

pub const struct_a: StructA = .{ .number = 123 };
