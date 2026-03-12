const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn read(allocator: std.mem.Allocator, file: std.fs.File, offset: usize, len: usize) ![]u8 {
    if (windows_h.SetFilePointer(file.handle, @intCast(offset), null, windows_h.FILE_BEGIN) == 0) {
        return error.UnableToSeekFile;
    }
    const buffer: []u8 = try allocator.alloc(u8, len);
    const bytes_read = try file.read(buffer);
    return buffer[0..bytes_read];
}
