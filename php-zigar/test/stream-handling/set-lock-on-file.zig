const std = @import("std");

pub fn lock(file: std.Io.File) bool {
    return file.tryLock(.exclusive) catch false;
}

pub fn unlock(file: std.Io.File) bool {
    file.unlock();
    return true;
}
