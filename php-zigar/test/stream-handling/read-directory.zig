const std = @import("std");

pub fn print(dir: std.Io.Dir) !void {
    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        std.debug.print("{s} {s}\n", .{ entry.name, @tagName(entry.kind) });
    }
}
