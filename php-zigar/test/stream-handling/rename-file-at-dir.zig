const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub fn rename(dir: std.Io.Dir, path: []const u8, new_path: []const u8) !void {
    try dir.rename(path, dir, new_path, threaded_io.io());
}
