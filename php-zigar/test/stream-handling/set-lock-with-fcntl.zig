const std = @import("std");

pub fn lock(file: std.fs.File) !void {
    const flock: std.c.Flock = .{
        .type = std.c.F.WRLCK,
        .whence = 0,
        .pid = 123,
        .start = 1234,
        .len = 8000,
    };
    if (std.c.fcntl(file.handle, std.c.F.SETLK, @intFromPtr(&flock)) != 0) return error.UnableToSetLock;
}
