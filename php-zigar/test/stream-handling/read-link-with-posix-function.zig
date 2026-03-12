const std = @import("std");

pub fn readLink(allocator: std.mem.Allocator, path: []const u8) ![]const u8 {
    var buffer: [4096]u8 = undefined;
    const result = try std.posix.readlink(path, &buffer);
    return allocator.dupe(u8, result);
}
