const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn seek(path: [*:0]const u8, offset: isize) !c.off_t {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = c.close(fd);
    const pos = c.lseek(fd, @intCast(offset), c.SEEK_END);
    if (pos < 0) return error.UnableToSeekFile;
    return c.lseek(fd, 0, c.SEEK_CUR);
}
