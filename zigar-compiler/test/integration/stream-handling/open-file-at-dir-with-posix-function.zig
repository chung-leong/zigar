const std = @import("std");

const c = @import("c");

pub fn write(dir: std.Io.Dir, path: [*:0]const u8, text: []const u8) !isize {
    const fd = c.openat(dir.handle, path, c.O_WRONLY);
    if (fd == -1) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const written = c.write(fd, text.ptr, text.len);
    if (written < 0) return error.UnableToWrite;
    return written;
}
