const std = @import("std");

const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};

pub fn print(value: Variant) void {
    std.debug.print("{any}\n", .{value});
}
