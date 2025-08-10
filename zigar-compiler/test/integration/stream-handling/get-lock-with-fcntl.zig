const std = @import("std");

pub fn check(file: std.fs.File) !?std.c.Flock {
    var flock: std.c.Flock = .{
        .type = std.c.F.WRLCK,
        .whence = 0,
        .pid = 123,
        .start = 1234,
        .len = 8000,
    };
    if (std.c.fcntl(file.handle, std.c.F.GETLK, @intFromPtr(&flock))) |_| {
        if (flock.type != std.c.F.UNLCK) return error.Unexpected;
        return null;
    } else |err| {
        if (err != error.Locked) return err;
        return flock;
    }
}
