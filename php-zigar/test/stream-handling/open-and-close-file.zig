const std = @import("std");

pub fn check(path: []const u8) bool {
    var file = std.fs.openFileAbsolute(path, .{}) catch return false;
    defer file.close();
    return true;
}
