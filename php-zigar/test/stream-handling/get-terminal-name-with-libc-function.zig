const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
});

pub fn get1(allocator: std.mem.Allocator, file: std.fs.File) !?[]const u8 {
    const fd = file.handle;
    const name = c.ttyname(fd) orelse return null;
    return try allocator.dupe(u8, std.mem.sliceTo(name, 0));
}

pub fn get2(allocator: std.mem.Allocator, file: std.fs.File) !?[]const u8 {
    const fd = file.handle;
    var buf: [1024]u8 = undefined;
    if (c.ttyname_r(fd, &buf, buf.len) != 0) return null;
    return try allocator.dupe(u8, std.mem.sliceTo(&buf, 0));
}
