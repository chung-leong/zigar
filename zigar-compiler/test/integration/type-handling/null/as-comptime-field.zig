const std = @import("std");

pub const StructA = struct {
    number: i32,
    comptime empty: @TypeOf(null) = null,
};

pub const struct_a: StructA = .{ .number = 123 };
