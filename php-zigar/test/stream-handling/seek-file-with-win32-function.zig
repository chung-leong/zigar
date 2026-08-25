const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const c = @import("c");

const io = threaded_io.io();

pub fn read(allocator: std.mem.Allocator, file: std.Io.File, offset: usize, len: usize) ![]u8 {
    if (c.SetFilePointer(file.handle, @intCast(offset), null, c.FILE_BEGIN) == 0) {
        return error.UnableToSeekFile;
    }
    const buffer: []u8 = try allocator.alloc(u8, len);
    const slices: [1][]u8 = .{buffer};
    const bytes_read = try file.readStreaming(io, &slices);
    return buffer[0..bytes_read];
}
