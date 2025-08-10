const std = @import("std");

pub fn read(allocator: std.mem.Allocator, path: []const u8, offset: usize, len: usize) ![]u8 {
    const fd = try std.c.open(path, .{ .ACCMODE = .RDONLY }, 0);
    defer std.c.close(fd);
    try std.c.lseek_SET(fd, offset);
    var buffer: []u8 = try allocator.alloc(u8, len);
    const bytes_read = try std.c.read(fd, buffer);
    return buffer[0..bytes_read];
}
