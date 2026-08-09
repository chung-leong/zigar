const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub fn symlink(dir: std.Io.Dir, path: []const u8, new_path: []const u8) !void {
    try dir.symLink(threaded_io.io(), path, new_path, .{});
}
