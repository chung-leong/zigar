const c = @cImport({
    @cInclude("sys/time.h");
    @cInclude("fcntl.h");
});

pub fn setTimes(path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const fd = c.open(path, c.O_RDONLY);
    defer _ = c.close(fd);
    const tv: [2]c.struct_timeval = .{
        .{ .tv_sec = atime, .tv_usec = 25 },
        .{ .tv_sec = mtime, .tv_usec = 55 },
    };
    const result = c.futimes(fd, &tv);
    if (result != 0) return error.UnableToSetTimes;
}
