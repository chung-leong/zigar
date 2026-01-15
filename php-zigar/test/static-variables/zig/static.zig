const std = @import("std");

pub var x: i32 = 1234;
pub var y: [4]i32 = .{ 1, 2, 3, 4 };

pub fn printX() void {
    std.debug.print("x = {d}\n", .{x});
}

pub fn printY() void {
    std.debug.print("y = {any}\n", .{y});
}
