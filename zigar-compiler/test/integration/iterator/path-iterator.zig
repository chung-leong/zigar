const std = @import("std");

pub fn parsePath(path: []const u8) !std.fs.path.ComponentIterator(.posix, u8) {
    return std.fs.path.ComponentIterator(.posix, u8).init(path);
}
