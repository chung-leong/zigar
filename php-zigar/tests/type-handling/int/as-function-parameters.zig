const std = @import("std");

pub fn print1(arg1: u8, arg2: i32) void {
    std.debug.print("{d} {d}\n", .{ arg1, arg2 });
}

pub fn print2(arg1: i64, arg2: i128) void {
    std.debug.print("{x} {x}\n", .{ arg1, arg2 });
}
