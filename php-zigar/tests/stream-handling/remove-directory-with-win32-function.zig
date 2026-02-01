const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn remove(name: [*:0]const u8) !void {
    if (windows_h.RemoveDirectoryA(name) == 0) return error.UnableToRemoveDirectory;
}

pub fn removeW(name: [*:0]const u16) !void {
    if (windows_h.RemoveDirectoryW(name) == 0) return error.UnableToRemoveDirectory;
}
