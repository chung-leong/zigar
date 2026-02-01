const std = @import("std");

const fcntl_h = @cImport({
    @cInclude("fcntl.h");
});

extern fn scan_file_with_fscanf(c_int) void;

pub fn scan(file: std.fs.File) void {
    const fd = switch (@typeInfo(@TypeOf(file.handle))) {
        .pointer => fcntl_h._open_osfhandle(@bitCast(@intFromPtr(file.handle)), fcntl_h.O_RDONLY),
        .int => file.handle,
        else => @compileError("Unexpected"),
    };
    scan_file_with_fscanf(fd);
}
