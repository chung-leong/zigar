const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn print(dir: std.Io.Dir) !void {
    var iter = dir.iterate();
    while (try iter.next(io)) |entry| {
        std.debug.print("{s} {s}\n", .{ entry.name, @tagName(entry.kind) });
    }
}
