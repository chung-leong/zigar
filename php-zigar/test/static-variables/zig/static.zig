const std = @import("std");

pub var boolean: bool = true;

pub var x: i32 = 1234;
pub var y: @Vector(4, i32) = .{ 1, 2, 3, 4 };
pub var z: f32 = 3.12459;

pub fn printX() void {
    std.debug.print("x = {d}\n", .{x});
}

pub fn printY() void {
    std.debug.print("y = {any}\n", .{y});
}

pub fn printZ() void {
    std.debug.print("z = {d}\n", .{z});
}
