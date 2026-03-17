const std = @import("std");

pub fn create(allocator: std.mem.Allocator) !*i32 {
    const ptr = try allocator.create(i32);
    ptr.* = 1234;
    return ptr;
}
