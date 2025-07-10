const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn read(allocator: std.mem.Allocator, path: [*:0]const u8, offset: isize, len: usize) ![]u8 {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    _ = c.fseek(file, offset, c.SEEK_SET);
    var buffer: []u8 = try allocator.alloc(u8, len);
    const bytes_read = c.fread(buffer.ptr, 1, len, file);
    return buffer[0..bytes_read];
}
