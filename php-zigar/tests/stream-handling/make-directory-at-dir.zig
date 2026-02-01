const std = @import("std");

pub fn add(dir: std.fs.Dir, name: []const u8) !void {
    try dir.makeDir(name);
}
