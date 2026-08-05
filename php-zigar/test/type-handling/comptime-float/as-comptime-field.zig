const std = @import("std");

pub const StructA = struct {
    state: bool = false,
    comptime number: comptime_float = 1.234,
};

pub const struct_a: StructA = .{ .state = true };
