const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn readdir(path: []const u8) !std.Io.Dir.Iterator {
    const dir = try std.Io.Dir.openDirAbsolute(io, path, .{ .iterate = true });
    return dir.iterate();
}
