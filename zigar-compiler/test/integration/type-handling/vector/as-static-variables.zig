const std = @import("std");

pub const v1: @Vector(4, f64) = .{ 1, 2, 3, 4 };
pub var v2: @Vector(3, f32) = undefined;

pub fn print() void {
    std.debug.print("{d}\n", .{v2});
}
