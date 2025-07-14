const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn write(dir_path: [*:0]const u8, path: [*:0]const u8, text: []const u8) !isize {
    const dirfd = c.open(dir_path, c.O_DIRECTORY);
    if (dirfd == -1) return error.UnableToOpenDirectory;
    defer _ = c.close(dirfd);
    const fd = c.openat(dirfd, path, c.O_WRONLY);
    if (fd == -1) return error.UnableToOpenFile;
    defer _ = c.close(dirfd);
    const written = c.write(fd, text.ptr, text.len);
    if (written < 0) return error.UnableToWrite;
    return written;
}
