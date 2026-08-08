const std = @import("std");

pub fn symlink(dir: std.Io.Dir, path: []const u8, new_path: []const u8) !void {
    try dir.symLink(path, new_path, .{});
}
