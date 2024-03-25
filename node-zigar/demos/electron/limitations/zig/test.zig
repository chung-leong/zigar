const std = @import("std");

pub fn greeting(allocator: std.mem.Allocator, copy: bool) ![]const u8 {
    const s = "Hello world";
    return if (copy) try allocator.dupe(u8, s) else s;
}

pub const constant_number: i32 = 1234;
pub var variable_number: i32 = 1234;
