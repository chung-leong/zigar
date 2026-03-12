const std = @import("std");

pub var vector1: @Vector(4, u8) = .{ 1, 2, 3, 4 };
pub var vector2: @Vector(4, u32) = .{ 1, 2, 3, 4 };
pub var vector3: @Vector(4, u64) = .{ 1, 2, 3, 4 };

pub fn print1() void {
    std.debug.print("{any}\n", .{vector1});
}

pub fn print2() void {
    std.debug.print("{any}\n", .{vector2});
}

pub fn print3() void {
    std.debug.print("{any}\n", .{vector3});
}
