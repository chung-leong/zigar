const std = @import("std");

pub fn readFile(allocator: std.mem.Allocator, path: []u8) ![]u8 {
    const file = try std.fs.openFileAbsolute(path, .{});
    return file.readToEndAlloc(allocator, 1024 * 3);
}
