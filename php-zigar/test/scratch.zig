const std = @import("std");

var counter: usize = 0;

pub fn print() !void {
    std.debug.print("counter = {d}\n", .{counter});
    counter += 1;
}
