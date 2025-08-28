const std = @import("std");

pub fn writeAt(path: [*:0]const u8, data: []const u8, offset: usize) !usize {
    const oflags: std.c.O = if (@hasField(std.c.O, "ACCMODE"))
        .{ .ACCMODE = .WRONLY }
    else
        .{ .write = true };
    const fd = std.c.open(path, oflags);
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    const written = std.c.pwrite(fd, data.ptr, data.len, @intCast(offset));
    if (written < 0) return error.UnableToWriteToFile;
    return @intCast(written);
}
