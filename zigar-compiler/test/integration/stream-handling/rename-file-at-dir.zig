const std = @import("std");

pub fn rename(dir: std.Io.Dir, path: []const u8, new_path: []const u8) !void {
    try dir.rename(path, new_path);
}
