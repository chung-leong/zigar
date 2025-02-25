const std = @import("std");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn floatToString(num: f64) ![]const u8 {
    return std.fmt.allocPrint(allocator, "{d}", .{num});
}

pub fn freeString(str: []const u8) void {
    allocator.free(str);
}
