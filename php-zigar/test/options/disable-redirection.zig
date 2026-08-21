const std = @import("std");
var thread_io = std.Io.Threaded.init_single_threaded;

const io = thread_io.io();

pub fn check(path: []const u8) bool {
    var file = std.Io.Dir.openFileAbsolute(io, path, .{}) catch return false;
    defer file.close(io);
    return true;
}
