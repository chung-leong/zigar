const std = @import("std");

pub var text: []const u8 = "Hello world";
pub var alt_text: []const u8 = "Goodbye cruel world";

pub fn printText() void {
    std.debug.print("{s}\n", .{text});
}

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn allocText(src: []const u8) ![]const u8 {
    const dest = try allocator.alloc(u8, src.len);
    @memcpy(dest, src);
    return dest;
}

pub fn freeText(dest: []const u8) void {
    allocator.free(dest);
}
