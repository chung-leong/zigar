const std = @import("std");

pub fn readAt(allocator: std.mem.Allocator, path: [*:0]const u8, offset: usize, len: usize) ![]const u8 {
    const fd = std.c.open(path, .{ .ACCMODE = .RDONLY });
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    const buffer: []u8 = try allocator.alloc(u8, len);
    const read = std.c.pread(fd, buffer.ptr, buffer.len, @intCast(offset));
    if (read < 0) return error.UnableToReadFile;
    const end: usize = @intCast(read);
    return buffer[0..end];
}
