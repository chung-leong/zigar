const std = @import("std");

var gpa: std.heap.DebugAllocator(.{}) = .init;

pub const allocator = gpa.allocator();
pub const Slice = []const u8;

pub fn dupe(a: std.mem.Allocator, s: []const u8) ![]u8 {
    const copy = try a.dupe(u8, s);
    std.debug.print("ptr = {x}\n", .{@intFromPtr(copy.ptr)});
    return copy;
}

pub fn free(s: []const u8) void {
    std.debug.print("allocator = {x}, s = {x}\n", .{ @intFromPtr(&allocator), @intFromPtr(s.ptr) });
    allocator.free(s);
    std.debug.print("ok\n", .{});
}
