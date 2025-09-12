const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("sys/stat.h");
});

pub fn removeDirectory(path: [*:0]const u8) !void {
    const result = c.rmdir(path);
    if (result < 0) return error.UnableToRemoveDirectory;
}
