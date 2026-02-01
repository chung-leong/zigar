const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn get(file: std.fs.File) !u64 {
    var size_high: windows_h.DWORD = undefined;
    const size_low = windows_h.GetFileSize(file.handle, &size_high);
    if (size_low == windows_h.INVALID_FILE_SIZE and windows_h.GetLastError() != 0) {
        return error.UnableToGetFileSize;
    }
    return @as(u64, size_low) | (@as(u64, size_high) << 32);
}

pub fn getEx(file: std.fs.File) !u64 {
    var size: windows_h.LARGE_INTEGER = undefined;
    if (windows_h.GetFileSizeEx(file.handle, &size) != windows_h.TRUE) return error.UnableToGetFileSize;
    return @intCast(size.QuadPart);
}
