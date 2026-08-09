const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub fn lock(file: std.Io.File) bool {
    return file.tryLock(threaded_io.io(), .exclusive) catch false;
}

pub fn unlock(file: std.Io.File) bool {
    file.unlock(threaded_io.io());
    return true;
}
