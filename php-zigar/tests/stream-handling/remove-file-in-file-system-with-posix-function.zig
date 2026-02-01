const std = @import("std");

const c = @cImport({
    @cInclude("unistd.h");
    @cInclude("sys/stat.h");
});

pub fn removeFile(path: [*:0]const u8) !void {
    const result = c.unlink(path);
    if (result < 0) return error.UnableToRemoveFile;
}
