const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub fn rename(path: []const u8, new_path: []const u8) !void {
    try std.Io.Dir.renameAbsolute(path, new_path, threaded_io.io());
}
