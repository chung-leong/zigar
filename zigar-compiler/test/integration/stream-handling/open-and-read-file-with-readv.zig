const std = @import("std");

pub fn read(path: [*:0]const u8, vectors: [3][]u8) !usize {
    const fd = std.c.open(path, .{ .ACCMODE = .RDONLY });
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    var iovs: [3]std.c.iovec = undefined;
    for (vectors, 0..) |v, i| {
        iovs[i].base = v.ptr;
        iovs[i].len = v.len;
    }
    const count = std.c.readv(fd, &iovs, 3);
    if (count < 0) return error.UnableToReadFile;
    return @intCast(count);
}
