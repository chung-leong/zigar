const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn getStartingPos(path: [:0]const u8) !c_long {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    var buffer: [128]u8 = undefined;
    while (true) {
        if (c.fread(&buffer, 1, buffer.len, file) == 0) break;
    }
    if (c.feof(file) == 0) return error.UnableToReachEOF;
    c.rewind(file);
    if (c.feof(file) != 0) return error.UnableToRewind;
    return c.ftell(file);
}
