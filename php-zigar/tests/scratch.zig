const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn print(s: []const u8) void {
    std.debug.print("Text: {s}\n", .{s});
}

pub fn check(path: [*:0]const u8) bool {
    std.debug.print("check: {s}\n", .{path});
    const fd = c.open(path, c.O_RDONLY);
    std.debug.print("fd = {d}\n", .{fd});
    if (fd == -1) return false;
    defer _ = c.close(fd);
    return true;
}
