const std = @import("std");

pub var vector1: @Vector(4, f16) = .{ 1.5, 2.5, 3.5, 4.5 };
pub var vector2: @Vector(4, f32) = .{ 1.5, 2.5, 3.5, 4.5 };
pub var vector3: @Vector(4, f64) = .{ 1.5, 2.5, 3.5, 4.5 };

pub fn print1() void {
    std.debug.print("{any}\n", .{vector1});
}

pub fn print2() void {
    std.debug.print("{any}\n", .{vector2});
}

pub fn print3() void {
    std.debug.print("{any}\n", .{vector3});
}
