const std = @import("std");

pub fn print(dir: std.fs.Dir) !void {
    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        const entry_type = switch (entry.kind) {
            .file => "file",
            .directory => "dir",
            else => "unknown",
        };
        std.debug.print("{s} ({s})\n", .{ entry.name, entry_type });
    }
}
