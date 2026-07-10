const std = @import("std");

const c = @import("c");

pub fn truncate(file: std.fs.File, len: c_long) !void {
    const fd = file.handle;
    _ = c.SetFilePointer(fd, len, null, c.FILE_BEGIN);
    if (c.SetEndOfFile(fd) != c.TRUE) return error.UnableToTruncate;
}
