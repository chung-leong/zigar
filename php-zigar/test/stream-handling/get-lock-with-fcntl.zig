const std = @import("std");

pub fn check(file: std.fs.File, exclusive: bool) !bool {
    var flock: std.c.Flock = .{
        .type = if (exclusive) std.c.F.WRLCK else std.c.F.RDLCK,
        .whence = 0,
        .pid = 123,
        .start = 1234,
        .len = 8000,
    };
    const result = std.c.fcntl(file.handle, std.c.F.GETLK, @intFromPtr(&flock));
    if (result < 0) return error.UnableToGetLock;
    return flock.type == std.c.F.UNLCK;
}

pub fn lock(file: std.fs.File, exclusive: bool) !void {
    const flock: std.c.Flock = .{
        .type = if (exclusive) std.c.F.WRLCK else std.c.F.RDLCK,
        .whence = 0,
        .pid = 123,
        .start = 1234,
        .len = 8000,
    };
    if (std.c.fcntl(file.handle, std.c.F.SETLK, @intFromPtr(&flock)) != 0) return error.UnableToSetLock;
}
