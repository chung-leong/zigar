const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn printString(f: *const fn (std.mem.Allocator) []const u8) void {
    const allocator = gpa.allocator();
    const s = f(allocator);
    defer allocator.free(s);
    std.debug.print("{s}\n", .{s});
}

pub fn printArray(f: *const fn (std.mem.Allocator) []const f64) void {
    const allocator = gpa.allocator();
    const a = f(allocator);
    defer allocator.free(a);
    std.debug.print("{any}\n", .{a});
}
