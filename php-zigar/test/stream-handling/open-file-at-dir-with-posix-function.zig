const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn write(dir: std.fs.Dir, path: [*:0]const u8, text: []const u8) !isize {
    const fd = c.openat(dir.fd, path, c.O_WRONLY);
    if (fd == -1) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const written = c.write(fd, text.ptr, text.len);
    if (written < 0) return error.UnableToWrite;
    return written;
}
