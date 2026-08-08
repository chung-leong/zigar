const std = @import("std");
const builtin = @import("builtin");

pub fn copy(src: std.Io.File, dest: std.Io.File) !usize {
    var read_buffer: [1024]u8 = undefined;
    var reader = src.reader(&read_buffer);
    var write_buffer: [1024]u8 = undefined;
    var writer = dest.writerStreaming(&write_buffer);
    const sent = try reader.interface.streamRemaining(&writer.interface);
    try writer.interface.flush();
    return sent;
}
