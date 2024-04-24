const std = @import("std");

pub const pi = std.math.pi;

pub fn printPi() void {
    std.debug.print("{d}\n", .{pi});
}
