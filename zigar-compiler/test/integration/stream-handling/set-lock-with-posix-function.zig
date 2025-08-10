const std = @import("std");

const c = @cImport({
    @cInclude("sys/file.h");
});

pub fn lock(file: std.fs.File) bool {
    return c.flock(file.handle, std.c.LOCK.EX) == 0;
}

pub fn unlock(file: std.fs.File) bool {
    return c.flock(file.handle, std.c.LOCK.UN) == 0;
}
