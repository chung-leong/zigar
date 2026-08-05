const std = @import("std");

const c = @import("c");

pub fn removeFile(path: [*:0]const u8) !void {
    const result = c.unlink(path);
    if (result < 0) return error.UnableToRemoveFile;
}
