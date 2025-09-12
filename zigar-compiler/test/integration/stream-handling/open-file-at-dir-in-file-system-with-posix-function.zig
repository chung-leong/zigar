const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn write(dir_path: [*:0]const u8, path: [*:0]const u8, text: []const u8) !isize {
    const dirfd = c.openat(c.AT_FDCWD, dir_path, c.O_DIRECTORY);
    if (dirfd < 0) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    const fd = c.openat(dirfd, path, c.O_WRONLY | c.O_CREAT, @as(c_int, 0o666));
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const written = c.write(fd, text.ptr, text.len);
    if (written < 0) return error.UnableToWrite;
    return written;
}
