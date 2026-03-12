const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
});

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const oflags: std.c.O = if (@hasField(std.c.O, "ACCMODE"))
        .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }
    else
        .{ .write = true, .CREAT = true, .TRUNC = true };
    const fd = std.c.open(path, oflags, @as(c_uint, 0o666));
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    const len = std.c.write(fd, data.ptr, data.len);
    if (len < 0) return error.UnableToWriteToFile;
    _ = c.fdatasync(fd);
    return @intCast(len);
}
