const std = @import("std");

const stdio = @cImport({
    @cInclude("stdio.h");
});

var file: *stdio.FILE = undefined;

pub fn open(path: [*:0]const u8) !void {
    file = stdio.fopen(path, "w") orelse return error.UnableToCreateFile;
    stdio.setbuf(file, null); // should do nothing
}

pub fn write(s: []const u8) void {
    _ = stdio.fwrite(s.ptr, 1, s.len, file);
}

pub fn writeFlush(s: []const u8) void {
    _ = stdio.fwrite(s.ptr, 1, s.len, file);
    _ = stdio.fflush(file);
}

pub fn writeFlushAll(s: []const u8) void {
    _ = stdio.fwrite(s.ptr, 1, s.len, file);
    _ = stdio.fflush(null);
}

pub fn close() void {
    _ = stdio.fclose(file);
}
