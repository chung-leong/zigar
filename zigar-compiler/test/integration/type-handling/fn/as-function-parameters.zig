const std = @import("std");

pub const Fn = *const fn () void;

pub fn print(value: Fn) void {
    std.debug.print("{any}\n", .{value});
}
