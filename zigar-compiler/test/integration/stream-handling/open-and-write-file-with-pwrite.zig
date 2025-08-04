const std = @import("std");

pub fn writeAt(path: []const u8, data: []const u8, offset: usize) !usize {
    const fd = try std.posix.open(path, .{ .ACCMODE = .WRONLY }, 0);
    defer std.posix.close(fd);
    return try std.posix.pwrite(fd, data, offset);
}
