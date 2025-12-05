const std = @import("std");

pub fn check(file: std.fs.File) !?std.c.Flock {
    var flock: std.c.Flock = undefined;
    flock.type = std.c.F.WRLCK;
    flock.whence = 0;
    flock.pid = 123;
    flock.start = 1234;
    flock.len = 8000;
    const result = std.c.fcntl(file.handle, std.c.F.GETLK, @intFromPtr(&flock));
    if (result < 0) return error.UnableToGetLock;
    return if (flock.type != std.c.F.UNLCK) flock else null;
}
