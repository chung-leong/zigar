const std = @import("std");

pub fn add(dir: std.Io.Dir, name: []const u8) !void {
    try dir.makeDir(name);
}
