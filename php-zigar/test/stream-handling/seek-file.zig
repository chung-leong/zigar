const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const io = threaded_io.io();

pub fn read(allocator: std.mem.Allocator, file: std.Io.File, offset: i64, len: usize) ![]u8 {
    var buffer: [1024]u8 = undefined;
    var reader = file.reader(io, &buffer);
    try reader.seekBy(offset);
    const ri = &reader.interface;
    return try ri.readAlloc(allocator, len);
}
