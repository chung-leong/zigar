const std = @import("std");

const c = @import("c");

pub fn remove(name: [*:0]const u8) !void {
    if (c.DeleteFileA(name) == 0) return error.UnableToDeleteFile;
}

pub fn removeW(name: [*:0]const u16) !void {
    if (c.DeleteFileW(name) == 0) return error.UnableToDeleteFile;
}
