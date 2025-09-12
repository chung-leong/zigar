const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
    @cInclude("sys/stat.h");
});

pub fn setTimes(path: [*:0]const u8, sec: i64, nsec: i64) !void {
    const times: [2]c.struct_timespec = .{
        .{ .tv_sec = sec, .tv_nsec = nsec },
        .{ .tv_sec = sec, .tv_nsec = nsec },
    };
    const result = c.utimensat(c.AT_FDCWD, path, &times, 0);
    if (result < 0) return error.UnableToSetTimes;
}
