const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn read(allocator: std.mem.Allocator, path: [:0]const u16, offset: usize, len: usize) ![]u8 {
    const handle = windows_h.CreateFileW(
        path,
        windows_h.GENERIC_READ,
        0,
        null,
        windows_h.OPEN_EXISTING,
        windows_h.FILE_ATTRIBUTE_NORMAL,
        null,
    );
    if (handle == null) return error.UnableToOpenFile;
    defer _ = windows_h.CloseHandle(handle);
    if (windows_h.SetFilePointer(handle, @intCast(offset), null, windows_h.FILE_BEGIN) == 0) {
        return error.UnableToSeekFile;
    }
    const buffer: []u8 = try allocator.alloc(u8, len);
    var bytes_read: windows_h.DWORD = undefined;
    if (windows_h.ReadFile(handle, buffer.ptr, @intCast(buffer.len), &bytes_read, null) == windows_h.FALSE) {
        return error.UnableToRead;
    }
    return buffer[0..bytes_read];
}
