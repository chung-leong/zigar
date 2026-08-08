const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub fn add(dir: std.Io.Dir, name: []const u8) !void {
    try dir.createDir(threaded_io.io(), name, .default_dir);
}
