const std = @import("std");

pub fn save(path: []const u8, data: []const u8) !usize {
    const fd = try std.posix.open(path, .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }, 0x666);
    defer std.posix.close(fd);
    return try std.posix.write(fd, data);
}
