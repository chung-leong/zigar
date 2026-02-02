const std = @import("std");

pub const StructA = packed struct {
    vector1: @Vector(4, i32) = .{ 1, 2, 3, 4 },
    vector2: @Vector(4, i32) = .{ 2, 3, 4, 5 },
    number: u10 = 100,
    vector3: @Vector(4, i32) = .{ 3, 4, 5, 6 },
};

pub var struct_a: StructA = .{
    .vector1 = .{ 10, 20, 30, 40 },
    .vector2 = .{ 11, 21, 31, 41 },
    .number = 200,
    .vector3 = .{ 12, 22, 32, 42 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
