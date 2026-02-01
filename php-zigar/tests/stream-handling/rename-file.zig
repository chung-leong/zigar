const std = @import("std");

pub fn rename(path: []const u8, new_path: []const u8) !void {
    try std.fs.renameAbsolute(path, new_path);
}
