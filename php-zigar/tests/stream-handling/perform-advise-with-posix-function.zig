const std = @import("std");

const c = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("unistd.h");
    @cInclude("fcntl.h");
});

pub fn save(path: [*:0]const u8, data: []const u8) !usize {
    const oflags: std.c.O = if (@hasField(std.c.O, "ACCMODE"))
        .{ .ACCMODE = .WRONLY, .CREAT = true, .TRUNC = true }
    else
        .{ .write = true, .CREAT = true, .TRUNC = true };
    const fd = std.c.open(path, oflags, @as(c_uint, 0o666));
    if (fd < 0) return error.UnableToOpenFile;
    defer _ = std.c.close(fd);
    if (c.posix_fadvise(fd, 5, 1000, c.POSIX_FADV_RANDOM) != 0) return error.AdviseFailed;
    const len = std.c.write(fd, data.ptr, data.len);
    if (len < 0) return error.UnableToWriteToFile;
    return @intCast(len);
}
