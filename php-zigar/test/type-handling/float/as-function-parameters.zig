const std = @import("std");

pub fn print1(arg1: f16, arg2: f32) void {
    std.debug.print("{d} {d}\n", .{ arg1, arg2 });
}

pub fn print2(arg1: f64, arg2: f80, arg3: f128) void {
    std.debug.print("{d} {any} {any}\n", .{ arg1, arg2, arg3 });
}
