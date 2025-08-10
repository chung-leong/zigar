const std = @import("std");

pub fn writeAt(path: []const u8, data: []const u8, offset: usize) !usize {
    const fd = try std.c.open(path, .{ .ACCMODE = .WRONLY }, 0);
    defer std.c.close(fd);
    return try std.c.pwrite(fd, data, offset);
}
