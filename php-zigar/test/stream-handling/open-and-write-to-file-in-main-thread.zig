const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn save(path: []const u8, data: []const u8) !usize {
    var file = try std.Io.Dir.createFileAbsolute(io, path, .{});
    defer file.close(io);
    const slices: [1][]const u8 = .{data};
    return try file.writeStreaming(io, &.{}, slices[0..], 1);
}
