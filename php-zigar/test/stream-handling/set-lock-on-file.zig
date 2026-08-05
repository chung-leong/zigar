const std = @import("std");

pub fn lock(file: std.fs.File) bool {
    return file.tryLock(.exclusive) catch false;
}

pub fn unlock(file: std.fs.File) bool {
    file.unlock();
    return true;
}
