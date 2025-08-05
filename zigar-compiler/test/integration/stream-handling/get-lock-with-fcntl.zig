const std = @import("std");

pub fn check(file: std.fs.File) !?std.posix.Flock {
    var flock: std.posix.Flock = .{
        .type = std.posix.F.WRLCK,
        .whence = 0,
        .pid = 123,
        .start = 1234,
        .len = 8000,
    };
    if (std.posix.fcntl(file.handle, std.posix.F.GETLK, @intFromPtr(&flock))) |_| {
        if (flock.type != std.posix.F.UNLCK) return error.Unexpected;
        return null;
    } else |err| {
        if (err != error.Locked) return err;
        return flock;
    }
}
