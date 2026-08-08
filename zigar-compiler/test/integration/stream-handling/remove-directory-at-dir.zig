const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub fn remove(dir: std.Io.Dir, name: []const u8) !void {
    try dir.deleteDir(threaded_io.io(), name);
}
