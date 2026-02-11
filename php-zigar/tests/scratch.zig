const std = @import("std");

const c = @cImport({
    @cInclude("fcntl.h");
    @cInclude("unistd.h");
});

pub fn print(s: []const u8) void {
    std.debug.print("Text: {s}\n", .{s});
}

pub fn check(path: []const u8) bool {
    var file = std.fs.openFileAbsolute(path, .{}) catch return false;
    defer file.close();
    return true;
}
