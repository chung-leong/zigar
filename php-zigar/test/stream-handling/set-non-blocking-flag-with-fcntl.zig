const std = @import("std");

pub fn setNonBlocking(file: std.fs.File, nonblocking: bool) !void {
    const fd = file.handle;
    const oflags: std.c.O = .{ .NONBLOCK = nonblocking };
    const oflags_int: @typeInfo(std.c.O).@"struct".backing_integer.? = @bitCast(oflags);
    if (std.c.fcntl(fd, std.c.F.SETFL, oflags_int) != 0) return error.UnableToSetFlag;
}
