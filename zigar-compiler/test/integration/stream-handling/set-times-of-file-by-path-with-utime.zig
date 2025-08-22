const std = @import("std");

const c = @cImport({
    @cInclude("utime.h");
});

pub fn setTimes(path: [*:0]const u8, atime: u32, mtime: u32) !void {
    const times: c.utimbuf = .{
        .actime = atime,
        .modtime = mtime,
    };
    const result = c.utime(path, &times);
    if (result != 0) return error.UnableToSetTimes;
}
