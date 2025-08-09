const std = @import("std");

const stdio = @cImport({
    @cInclude("stdio.h");
});

pub fn print(f: std.fs.File) !void {
    const file = stdio.fdopen(f.handle, "r") orelse return error.UnableToOpenFile;
    defer _ = stdio.fclose(file);
    while (true) {
        const result = stdio.fgetc(file);
        if (result < 0) break;
        const c: u8 = @intCast(result);
        std.debug.print("{c}", .{c});
    }
}
