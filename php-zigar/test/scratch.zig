const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn print(dir: std.Io.Dir) !void {
    var iter = dir.iterate();
    while (try iter.next(io)) |entry| {
        const entry_type = switch (entry.kind) {
            .file => "file",
            .directory => "dir",
            else => "unknown",
        };
        std.debug.print("{s} ({s})\n", .{ entry.name, entry_type });
    }
}

pub fn hello() void {
    std.debug.print("Hello world!\n", .{});
}
