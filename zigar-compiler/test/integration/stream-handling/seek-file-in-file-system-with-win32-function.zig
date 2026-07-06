const std = @import("std");

const c = @import("c");

pub fn read(allocator: std.mem.Allocator, path: [:0]const u16, offset: usize, len: usize) ![]u8 {
    const handle = c.CreateFileW(
        path,
        c.GENERIC_READ,
        0,
        null,
        c.OPEN_EXISTING,
        c.FILE_ATTRIBUTE_NORMAL,
        null,
    );
    if (handle == null) return error.UnableToOpenFile;
    defer _ = c.CloseHandle(handle);
    if (c.SetFilePointer(handle, @intCast(offset), null, c.FILE_BEGIN) == 0) {
        return error.UnableToSeekFile;
    }
    const buffer: []u8 = try allocator.alloc(u8, len);
    var bytes_read: c.DWORD = undefined;
    if (c.ReadFile(handle, buffer.ptr, @intCast(buffer.len), &bytes_read, null) == c.FALSE) {
        return error.UnableToRead;
    }
    return buffer[0..bytes_read];
}
