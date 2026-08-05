const std = @import("std");

pub fn symlink(dir: std.fs.Dir, path: []const u8, new_path: []const u8) !void {
    try dir.symLink(path, new_path, .{});
}
