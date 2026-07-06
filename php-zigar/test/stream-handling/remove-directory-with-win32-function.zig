const std = @import("std");

const c = @import("c");

pub fn remove(name: [*:0]const u8) !void {
    if (c.RemoveDirectoryA(name) == 0) return error.UnableToRemoveDirectory;
}

pub fn removeW(name: [*:0]const u16) !void {
    if (c.RemoveDirectoryW(name) == 0) return error.UnableToRemoveDirectory;
}
