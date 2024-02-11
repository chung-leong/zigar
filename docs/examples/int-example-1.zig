const std = @import("std");

pub fn print32(number: i32) void {
    std.debug.print("number = {d}\n", .{number});
}

pub fn print33(number: i33) void {
    std.debug.print("number = {d}\n", .{number});
}
