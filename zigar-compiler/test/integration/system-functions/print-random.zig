const std = @import("std");

pub fn print() !void {
    var buffer: [16]u8 = undefined;
    try std.c.getrandom(&buffer);
    std.debug.print("{d}\n", .{buffer});
}
