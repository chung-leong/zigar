const std = @import("std");

const c = @cImport({
    @cInclude("sys/stat.h");
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn truncate(file: std.fs.File, len: c_long) !void {
    const fd = file.handle;
    if (c.ftruncate(fd, len) != 0) return error.UnableToTruncate;
}
