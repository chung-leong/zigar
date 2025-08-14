const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn seek(path: [*:0]const u8, offset: isize) !isize {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    _ = c.fseek(file, @intCast(offset), c.SEEK_END);
    return c.ftell(file);
}
