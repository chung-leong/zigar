const std = @import("std");

pub fn toUpperCase(allocator: std.mem.Allocator, s: []const u8) ![]const u8 {
    return try std.ascii.allocUpperString(allocator, s);
}
