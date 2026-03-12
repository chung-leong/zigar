const std = @import("std");

pub fn save(data: []const u8, file: std.fs.File) !usize {
    return try file.write(data);
}
