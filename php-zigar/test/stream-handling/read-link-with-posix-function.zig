const std = @import("std");

pub fn readLink(allocator: std.mem.Allocator, path: [:0]const u8) ![]const u8 {
    var buffer: [4096]u8 = undefined;
    const result = std.c.readlink(path.ptr, &buffer, buffer.len);
    if (result < 0) return error.UnableToReadLink;
    const len: usize = @intCast(result);
    return allocator.dupe(u8, buffer[0..len]);
}
