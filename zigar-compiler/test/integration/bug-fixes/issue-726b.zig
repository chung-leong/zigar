const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn print(path: []const u8) !void {
    var dir = try std.Io.Dir.openDirAbsolute(io, path, .{ .iterate = true });
    defer dir.close(io);
    var iter = dir.iterate();
    while (try iter.next(io)) |entry| {
        std.debug.print("{s}\n", .{entry.name});
    }
}
