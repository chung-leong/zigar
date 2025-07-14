const std = @import("std");

const c = @cImport({
    @cInclude("sys/time.h");
    @cInclude("sys/stat.h");
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn setTimes(dir_path: [*:0]const u8, path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const dirfd = c.open(dir_path, c.O_DIRECTORY);
    if (dirfd == -1) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    const times: [2]c.struct_timespec = .{
        .{ .tv_sec = atime, .tv_nsec = 25 },
        .{ .tv_sec = mtime, .tv_nsec = 55 },
    };
    const result = c.utimensat(dirfd, path, &times, c.AT_SYMLINK_NOFOLLOW);
    if (result != 0) return error.UnableToSetTimes;
}
