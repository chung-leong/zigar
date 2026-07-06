const c = @import("c");

pub fn setTimes(path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const tv: [2]c.struct_timeval = .{
        .{ .tv_sec = atime, .tv_usec = 25 },
        .{ .tv_sec = mtime, .tv_usec = 55 },
    };
    const result = c.utimes(path, &tv);
    if (result != 0) return error.UnableToSetTimes;
}

pub fn setLinkTimes(path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const tv: [2]c.struct_timeval = .{
        .{ .tv_sec = atime, .tv_usec = 25 },
        .{ .tv_sec = mtime, .tv_usec = 55 },
    };
    if (!@hasDecl(c, "lutimes")) return error.UnableToSetTimes;
    const result = c.lutimes(path, &tv);
    if (result != 0) return error.UnableToSetTimes;
}
