const std = @import("std");

pub const StructA = packed struct {
    empty1: @TypeOf(undefined) = undefined,
    empty2: @TypeOf(undefined) = undefined,
    number: u10 = 100,
    empty3: @TypeOf(undefined) = undefined,
};

pub const struct_a: StructA = .{ .empty1 = undefined, .empty2 = undefined, .number = 200, .empty3 = undefined };
