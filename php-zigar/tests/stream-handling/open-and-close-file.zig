const std = @import("std");

pub fn check(path: []const u8) bool {
    std.debug.print("check: {s}\n", .{path});
    var file = std.fs.openFileAbsolute(path, .{}) catch return false;
    defer file.close();
    return true;
}
