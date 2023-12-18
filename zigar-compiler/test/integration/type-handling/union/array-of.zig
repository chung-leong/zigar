const std = @import("std");

const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub var array: [4]Variant = .{
    .{ .Integer = 123 },
    .{ .Float = 1.23 },
    .{ .String = "world" },
    .{ .Integer = 777 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
