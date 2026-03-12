const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn read(allocator: std.mem.Allocator, path: [*:0]const u8, offset: usize, len: usize) ![]u8 {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const pos = c.lseek(fd, @intCast(offset), c.SEEK_SET);
    if (pos < 0) return error.UnableToSeekFile;
    var buffer: []u8 = try allocator.alloc(u8, len);
    const bytes_read = c.read(fd, buffer.ptr, @intCast(buffer.len));
    if (bytes_read < 0) return error.UnableToReadFile;
    const end: usize = @intCast(bytes_read);
    return buffer[0..end];
}
