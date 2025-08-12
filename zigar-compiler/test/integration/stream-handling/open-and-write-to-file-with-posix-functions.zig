const std = @import("std");

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const fd = std.c.open(path, .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }, @as(c_uint, 0o666));
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    const count = std.c.write(fd, data.ptr, data.len);
    if (count < 0) return error.UnableToWriteToFile;
    return @intCast(count);
}
