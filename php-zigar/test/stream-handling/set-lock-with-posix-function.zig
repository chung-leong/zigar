const std = @import("std");

const c = @import("c");

pub fn lock(file: std.fs.File) bool {
    return c.flock(file.handle, std.c.LOCK.EX) == 0;
}

pub fn unlock(file: std.fs.File) bool {
    return c.flock(file.handle, std.c.LOCK.UN) == 0;
}
