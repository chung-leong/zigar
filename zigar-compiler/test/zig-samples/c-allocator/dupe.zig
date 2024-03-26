const std = @import("std");
const allocator = std.heap.c_allocator;

pub fn dupe(text: []const u8) ![]const u8 {
    return allocator.dupe(u8, text);
}
