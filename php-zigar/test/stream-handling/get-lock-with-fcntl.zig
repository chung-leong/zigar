const std = @import("std");

pub fn check(file: std.Io.File, exclusive: bool) !bool {
    var flock: std.c.Flock = undefined;
    flock.type = if (exclusive) std.c.F.WRLCK else std.c.F.RDLCK;
    flock.whence = 0;
    flock.pid = 123;
    flock.start = 1234;
    flock.len = 8000;
    const result = std.c.fcntl(file.handle, std.c.F.GETLK, @intFromPtr(&flock));
    if (result < 0) return error.UnableToGetLock;
    return flock.type == std.c.F.UNLCK;
}

pub fn lock(file: std.Io.File, exclusive: bool) !void {
    var flock: std.c.Flock = undefined;
    flock.type = if (exclusive) std.c.F.WRLCK else std.c.F.RDLCK;
    flock.whence = 0;
    flock.pid = 123;
    flock.start = 1234;
    flock.len = 8000;
    if (std.c.fcntl(file.handle, std.c.F.SETLK, @intFromPtr(&flock)) != 0) return error.UnableToSetLock;
}
