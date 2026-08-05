const std = @import("std");

const c = @import("c");

pub fn mkdir(name: [*:0]const u8) !void {
    if (c.CreateDirectoryA(name, null) == 0) return error.UnableToMakeDirectory;
}

pub fn mkdirW(name: [*:0]const u16) !void {
    if (c.CreateDirectoryW(name, null) == 0) return error.UnableToMakeDirectory;
}
