const c = @import("c");

pub fn setTimes(path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const fd = c.open(path, c.O_RDONLY);
    defer _ = c.close(fd);
    var tb: c.struct__utimbuf = .{
        .actime = atime,
        .modtime = mtime,
    };
    const result = c._futime(fd, &tb);
    if (result != 0) return error.UnableToSetTimes;
}
