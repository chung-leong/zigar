const std = @import("std");

pub var vector: @Vector(4, @Vector(2, f64)) = .{
    .{ 1, 2 },
    .{ 1, 2 },
    .{ 1, 2 },
    .{ 1, 2 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
