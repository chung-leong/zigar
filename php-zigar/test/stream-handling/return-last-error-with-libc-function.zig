const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn triggerError(path: [:0]const u8) !std.c.E {
    const file = c.fopen(path, "r") orelse return error.UnableToOpenFile;
    defer _ = c.fclose(file);
    var buffer: [128]u8 = undefined;
    const read = c.fread(&buffer, 1, buffer.len, file);
    if (read != buffer.len and c.feof(file) == 0) {
        const err = c.ferror(file);
        c.clearerr(file);
        if (c.ferror(file) != 0) {
            return error.UnableToClearError;
        }
        return @enumFromInt(err);
    }
    return .SUCCESS;
}
