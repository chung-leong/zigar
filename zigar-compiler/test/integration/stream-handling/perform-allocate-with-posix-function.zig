const std = @import("std");

const c = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn save(path: []const u8, data: []const u8) !usize {
    const fd = try std.c.open(path, .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }, 0x666);
    defer std.c.close(fd);
    if (c.fallocate(fd, 0, 0, 1000) != 0) return error.AllocationFailed;
    const len = try std.c.write(fd, data);
    return len;
}
