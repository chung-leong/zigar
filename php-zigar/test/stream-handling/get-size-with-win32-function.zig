const std = @import("std");

const c = @import("c");

pub fn get(file: std.fs.File) !u64 {
    var size_high: c.DWORD = undefined;
    const size_low = c.GetFileSize(file.handle, &size_high);
    if (size_low == c.INVALID_FILE_SIZE and c.GetLastError() != 0) {
        return error.UnableToGetFileSize;
    }
    return @as(u64, size_low) | (@as(u64, size_high) << 32);
}

pub fn getEx(file: std.fs.File) !u64 {
    var size: c.LARGE_INTEGER = undefined;
    if (c.GetFileSizeEx(file.handle, &size) != c.TRUE) return error.UnableToGetFileSize;
    return @intCast(size.QuadPart);
}
