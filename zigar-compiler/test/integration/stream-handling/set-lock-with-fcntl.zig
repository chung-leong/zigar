const std = @import("std");

pub fn lock(file: std.fs.File) !void {
    const flock: std.posix.Flock = .{
        .type = std.posix.F.WRLCK,
        .whence = 0,
        .pid = 123,
        .start = 1234,
        .len = 8000,
    };
    _ = try std.posix.fcntl(file.handle, std.posix.F.SETLK, @intFromPtr(&flock));
}
