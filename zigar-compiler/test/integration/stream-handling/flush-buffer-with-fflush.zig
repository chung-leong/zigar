const std = @import("std");

const c = @import("c");

var file: *c.FILE = undefined;

pub fn open(path: [*:0]const u8) !void {
    file = c.fopen(path, "w") orelse return error.UnableToCreateFile;
}

pub fn write(s: []const u8) void {
    _ = c.fwrite(s.ptr, 1, s.len, file);
}

pub fn writeFlush(s: []const u8) void {
    _ = c.fwrite(s.ptr, 1, s.len, file);
    _ = c.fflush(file);
}

pub fn writeFlushAll(s: []const u8) void {
    _ = c.fwrite(s.ptr, 1, s.len, file);
    _ = c.fflush(null);
}

pub fn close() void {
    _ = c.fclose(file);
}
