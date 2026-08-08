const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn save(data: []const u8, file: std.Io.File) !usize {
    const slices: [1][]const u8 = .{data};
    return try file.writeStreaming(io, &.{}, slices[0..], 1);
}
