const std = @import("std");

pub fn getMessage(allocator: std.mem.Allocator, a: i32, b: i64, c: f64) []const u8 {
    return std.fmt.allocPrint(allocator, "Numbers: {d}, {d}, {d}", .{ a, b, c }) catch "Error";
}
