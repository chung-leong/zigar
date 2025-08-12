const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn seek(path: [*:0]const u8, offset: isize) !std.c.off_t {
    const fd = std.c.open(path, .{ .ACCMODE = .RDONLY });
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    const pos = std.c.lseek(fd, offset, std.c.SEEK.END);
    if (pos < 0) return error.UnableToSeekFile;
    return std.c.lseek(fd, 0, std.c.SEEK.CUR);
}
