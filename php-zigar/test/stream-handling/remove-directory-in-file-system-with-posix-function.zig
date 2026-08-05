const std = @import("std");

const c = @import("c");

pub fn removeDirectory(path: [*:0]const u8) !void {
    const result = c.rmdir(path);
    if (result < 0) return error.UnableToRemoveDirectory;
}
