const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn seek(path: []const u8, offset: isize) !std.c.off_t {
    const fd = try std.c.open(path, .{ .ACCMODE = .RDONLY }, 0);
    defer std.c.close(fd);
    try std.c.lseek_END(fd, offset);
    return std.c.lseek(fd, 0, 1);
}
