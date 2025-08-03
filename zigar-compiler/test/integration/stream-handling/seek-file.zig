const std = @import("std");

pub fn read(allocator: std.mem.Allocator, file: std.fs.File, offset: usize, len: usize) ![]u8 {
    try file.seekTo(offset);
    const buffer: []u8 = try allocator.alloc(u8, len);
    const bytes_read = try file.read(buffer);
    return buffer[0..bytes_read];
}
