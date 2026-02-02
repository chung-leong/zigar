const std = @import("std");

pub const StructA = struct {
    empty1: @TypeOf(undefined) = undefined,
    empty2: @TypeOf(undefined) = undefined,
};

pub const struct_a: StructA = .{ .empty1 = undefined, .empty2 = undefined };
