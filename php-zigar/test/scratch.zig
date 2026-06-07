const std = @import("std");

var gpa: std.heap.DebugAllocator(.{}) = .init;

pub const allocator = gpa.allocator();

pub const Callback = fn (std.mem.Allocator) []const u8;

pub fn call(cb: *const Callback) void {
    const text = cb(allocator);
    std.debug.print("{s}\n", .{text});
    allocator.free(text);
}
