const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn call(f: *const fn (std.mem.Allocator) []const u8) void {
    const allocator = gpa.allocator();
    const s = f(allocator);
    defer allocator.free(s);
    std.debug.print("{s}\n", .{s});
}
