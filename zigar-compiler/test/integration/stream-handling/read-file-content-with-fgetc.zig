const std = @import("std");

const stdio_h = @cImport({
    @cInclude("stdio.h");
});
const fcntl_h = @cImport({
    @cInclude("fcntl.h");
});

pub fn print(f: std.fs.File) !void {
    const fd = switch (@typeInfo(@TypeOf(f.handle))) {
        .pointer => fcntl_h._open_osfhandle(@bitCast(@intFromPtr(f.handle)), fcntl_h.O_RDONLY),
        .int => f.handle,
        else => @compileError("Unexpected"),
    };
    const file = stdio_h.fdopen(fd, "r") orelse return error.UnableToOpenFile;
    defer _ = stdio_h.fclose(file);
    while (true) {
        const result = stdio_h.fgetc(file);
        if (result < 0) break;
        const c: u8 = @intCast(result);
        std.debug.print("{c}", .{c});
    }
}
