const std = @import("std");

pub fn hello(x: i32, y: i32) void {
    std.debug.print("Hello world, {d} {d}\n", .{ x, y });
}
