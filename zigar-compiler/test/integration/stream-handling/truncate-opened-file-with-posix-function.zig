const std = @import("std");

const c = @import("c");

pub fn truncate(file: std.Io.File, len: c_long) !void {
    const fd = file.handle;
    if (c.ftruncate(fd, len) != 0) return error.UnableToTruncate;
}
