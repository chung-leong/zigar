const std = @import("std");

pub const StructA = struct {
    state: bool = false,
    comptime number: comptime_int = 1234,
};

pub const struct_a: StructA = .{ .state = true };
