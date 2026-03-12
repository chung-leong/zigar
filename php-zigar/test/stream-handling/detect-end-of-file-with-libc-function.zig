const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn detectEOF(path: [:0]const u8) !bool {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    var buffer: [128]u8 = undefined;
    while (true) {
        if (c.fread(&buffer, 1, buffer.len, file) == 0) break;
    }
    return c.feof(file) != 0;
}
