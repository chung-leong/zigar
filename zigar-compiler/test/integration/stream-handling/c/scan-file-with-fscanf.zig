const std = @import("std");

extern fn scan_file_with_fscanf(c_int) void;

pub fn scan(file: std.fs.File) void {
    scan_file_with_fscanf(file.handle);
}
