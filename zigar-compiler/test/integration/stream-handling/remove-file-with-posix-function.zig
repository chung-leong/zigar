const std = @import("std");

pub fn remove(path: []const u8) !void {
    try std.c.unlink(path);
}
