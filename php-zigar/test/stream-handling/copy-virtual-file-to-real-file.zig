const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;
const builtin = @import("builtin");

const io = threaded_io.io();

pub fn copy(src: std.Io.File, dest: std.Io.File) !usize {
    var read_buffer: [1024]u8 = undefined;
    var reader = src.reader(io, &read_buffer);
    var write_buffer: [1024]u8 = undefined;
    var writer = dest.writerStreaming(io, &write_buffer);
    const sent = try reader.interface.streamRemaining(&writer.interface);
    try writer.interface.flush();
    return sent;
}
