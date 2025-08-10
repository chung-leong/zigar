const std = @import("std");

pub fn readAt(allocator: std.mem.Allocator, path: []const u8, offset: usize, len: usize) ![]const u8 {
    const fd = try std.c.open(path, .{ .ACCMODE = .RDONLY }, 0);
    defer std.c.close(fd);
    const buffer: []u8 = try allocator.alloc(u8, len);
    const read = try std.c.pread(fd, buffer, offset);
    return buffer[0..read];
}
