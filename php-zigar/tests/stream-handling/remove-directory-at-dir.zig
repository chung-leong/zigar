const std = @import("std");

pub fn remove(dir: std.fs.Dir, name: []const u8) !void {
    try dir.deleteDir(name);
}
