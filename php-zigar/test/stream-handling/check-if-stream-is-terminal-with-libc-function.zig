const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
});

pub fn check(file: std.fs.File) bool {
    const fd = file.handle;
    return c.isatty(fd) != 0;
}
