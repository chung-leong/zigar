const std = @import("std");

const c = @import("c");

extern fn scan_file_with_fscanf(c_int) void;

pub fn scan(file: std.fs.File) void {
    const fd = switch (@typeInfo(@TypeOf(file.handle))) {
        .pointer => c._open_osfhandle(@bitCast(@intFromPtr(file.handle)), c.O_RDONLY),
        .int => file.handle,
        else => @compileError("Unexpected"),
    };
    scan_file_with_fscanf(fd);
}
