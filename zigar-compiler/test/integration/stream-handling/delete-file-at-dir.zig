const std = @import("std");

pub fn remove(dir: std.Io.Dir, name: []const u8) !void {
    try dir.deleteFile(name);
}
