const std = @import("std");

pub fn remove(path: [*:0]const u8) !void {
    const result = std.c.unlink(path);
    if (result < 0) return error.UnableToUnlinkFile;
}
