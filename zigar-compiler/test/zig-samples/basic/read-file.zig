const std = @import("std");
var thread_io = std.Io.Threaded.init_single_threaded;

const io = thread_io.io();

pub fn readFile(allocator: std.mem.Allocator, path: []u8) ![]u8 {
    const file = try std.Io.Dir.openFileAbsolute(io, path, .{});
    defer file.close(io);
    const stat = try file.stat(io);
    const buffer = try allocator.alloc(u8, @intCast(stat.size));
    const slices: [1][]u8 = .{buffer};
    _ = try file.readStreaming(io, &slices);
    return buffer;
}
