const std = @import("std");

pub const constant_number: i32 = 1234;
pub var variable_number: i32 = 4567;

pub fn printVariable() void {
    std.debug.print("variable_number = {d} (Zig)\n", .{variable_number});
}

pub fn changeVariable() void {
    variable_number = 1999;
}

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var allocator = gpa.allocator();

pub fn floatToString(num: f64) ![]const u8 {
    return std.fmt.allocPrint(allocator, "{d}", .{num});
}

pub fn freeString(str: []const u8) void {
    allocator.free(str);
}
