const std = @import("std");

const c = @import("c");

pub fn setTimes(dir: std.fs.Dir, path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const times: [2]c.struct_timespec = .{
        .{ .tv_sec = atime, .tv_nsec = 25 },
        .{ .tv_sec = mtime, .tv_nsec = 55 },
    };
    const result = c.utimensat(dir.fd, path, &times, c.AT_SYMLINK_NOFOLLOW);
    if (result != 0) return error.UnableToSetTimes;
}
