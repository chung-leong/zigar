const std = @import("std");

pub fn readdir(path: []const u8) !std.fs.Dir.Iterator {
    const dir = try std.fs.openDirAbsolute(path, .{ .iterate = true });
    return dir.iterate();
}
