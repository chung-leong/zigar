// greeting.zig
const std = @import("std");

pub fn getGreeting(allocator: std.mem.Allocator, name: []const u8) ![]const u8 {
    return std.fmt.allocPrint(allocator, "Hello, {s}!\n", .{name});
}
