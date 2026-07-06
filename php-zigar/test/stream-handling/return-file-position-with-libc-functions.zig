const std = @import("std");

const c = @import("c");

pub fn seek(path: [*:0]const u8, offset: isize) !isize {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    _ = c.fseek(file, @intCast(offset), c.SEEK_END);
    return c.ftell(file);
}
