const std = @import("std");

const c = @import("c");

pub fn check(file: std.Io.File) bool {
    const fd = file.handle;
    return c.isatty(fd) != 0;
}
