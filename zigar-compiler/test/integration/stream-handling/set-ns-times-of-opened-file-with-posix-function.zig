const std = @import("std");

const c = @cImport({
    @cInclude("sys/time.h");
    @cInclude("sys/stat.h");
    @cInclude("unistd.h");
});

pub fn setTimes(path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const fd = std.c.open(path, .{ .ACCMODE = .RDONLY });
    defer _ = std.c.close(fd);
    const tv: [2]c.struct_timespec = .{
        .{ .tv_sec = atime, .tv_nsec = 25 },
        .{ .tv_sec = mtime, .tv_nsec = 55 },
    };
    const result = c.futimens(fd, &tv);
    if (result != 0) return error.UnableToSetTimes;
}
