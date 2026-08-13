const std = @import("std");

pub fn print() !void {
    var buffer: [16]u8 = undefined;
    if (std.c.getrandom(&buffer, buffer.len, 0) < 0) return error.UnableToGetRandomness;
    std.debug.print("{any}\n", .{buffer});
}
