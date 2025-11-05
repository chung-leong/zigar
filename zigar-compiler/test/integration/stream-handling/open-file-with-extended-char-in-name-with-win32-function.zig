const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn open() !void {
    const handle = windows_h.CreateFileA("\\\xC0\xC1\xC2\xC3\xC4\xC5", windows_h.GENERIC_READ, 0, null, 0, 0, null);
    if (handle == null) return error.UnableToCreateFile;
    defer _ = windows_h.CloseHandle(handle);
}
