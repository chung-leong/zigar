const std = @import("std");

pub fn create(allocator: std.mem.Allocator) ![]const u8 {
    return try allocator.dupe(u8, "Hello world");
}
