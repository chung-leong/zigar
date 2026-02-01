const std = @import("std");

pub fn symlink(path: []const u8, new_path: []const u8) !void {
    try std.fs.symLinkAbsolute(path, new_path, .{});
}
