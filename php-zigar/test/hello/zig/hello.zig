const std = @import("std");

pub fn hello(x: i32, y: i32) i64 {
    std.debug.print("Hello world, {d} {d}\n", .{ x, y });
    return -777;
}
