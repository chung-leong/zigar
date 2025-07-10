const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
});

pub fn save(path: []const u8, data: []const u8) !usize {
    const fd = try std.posix.open(path, .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }, 0x666);
    defer std.posix.close(fd);
    const len = try std.posix.write(fd, data);
    _ = c.fdatasync(fd);
    return len;
}
