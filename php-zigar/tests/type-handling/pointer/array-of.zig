const std = @import("std");

pub var array: [4][]const u8 = .{
    "dog",
    "cat",
    "monkey",
    "cow",
};
pub var alt_text: []const u8 = "bear";

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
