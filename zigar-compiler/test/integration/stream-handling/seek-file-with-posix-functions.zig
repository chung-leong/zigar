const std = @import("std");

pub fn read(allocator: std.mem.Allocator, path: [*:0]const u8, offset: usize, len: usize) ![]u8 {
    const fd = std.c.open(path, .{ .ACCMODE = .RDONLY });
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    const pos = std.c.lseek(fd, @intCast(offset), std.c.SEEK.SET);
    if (pos < 0) return error.UnableToSeekFile;
    var buffer: []u8 = try allocator.alloc(u8, len);
    const bytes_read = std.c.read(fd, buffer.ptr, buffer.len);
    if (bytes_read < 0) return error.UnableToReadFile;
    const end: usize = @intCast(bytes_read);
    return buffer[0..end];
}
