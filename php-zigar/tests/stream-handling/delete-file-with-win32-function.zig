const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn remove(name: [*:0]const u8) !void {
    if (windows_h.DeleteFileA(name) == 0) return error.UnableToDeleteFile;
}

pub fn removeW(name: [*:0]const u16) !void {
    if (windows_h.DeleteFileW(name) == 0) return error.UnableToDeleteFile;
}
