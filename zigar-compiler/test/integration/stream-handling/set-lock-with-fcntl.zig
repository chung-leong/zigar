const std = @import("std");

pub fn lock(file: std.fs.File) !void {
    var flock: std.c.Flock = undefined;
    flock.type = std.c.F.WRLCK;
    flock.whence = 0;
    flock.pid = 123;
    flock.start = 1234;
    flock.len = 8000;
    if (std.c.fcntl(file.handle, std.c.F.SETLK, @intFromPtr(&flock)) != 0) return error.UnableToSetLock;
}
