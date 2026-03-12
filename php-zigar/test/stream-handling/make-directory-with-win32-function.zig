const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn mkdir(name: [*:0]const u8) !void {
    if (windows_h.CreateDirectoryA(name, null) == 0) return error.UnableToMakeDirectory;
}

pub fn mkdirW(name: [*:0]const u16) !void {
    if (windows_h.CreateDirectoryW(name, null) == 0) return error.UnableToMakeDirectory;
}
