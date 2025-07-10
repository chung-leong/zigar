const std = @import("std");

const c = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn save(path: []const u8, data: []const u8) !usize {
    const fd = try std.posix.open(path, .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }, 0x666);
    defer std.posix.close(fd);
    if (c.posix_fadvise(fd, 5, 1000, c.POSIX_FADV_RANDOM) != 0) return error.AdviseFailed;
    const len = try std.posix.write(fd, data);
    return len;
}
