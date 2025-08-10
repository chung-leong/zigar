const std = @import("std");

pub fn create(path: []const u8) !void {
    try std.c.mkdir(path, 0);
}
