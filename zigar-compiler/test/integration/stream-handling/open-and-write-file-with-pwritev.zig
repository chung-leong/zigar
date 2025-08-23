const std = @import("std");

pub fn writeAt(path: [*:0]const u8, vectors: [3][]const u8, offset: usize) !usize {
    const fd = std.c.open(path, .{ .ACCMODE = .WRONLY });
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    var iovs: [3]std.c.iovec_const = undefined;
    for (vectors, 0..) |v, i| {
        iovs[i].base = v.ptr;
        iovs[i].len = v.len;
    }
    const written = std.c.pwritev(fd, &iovs, iovs.len, @intCast(offset));
    if (written < 0) return error.UnableToWriteToFile;
    return @intCast(written);
}
