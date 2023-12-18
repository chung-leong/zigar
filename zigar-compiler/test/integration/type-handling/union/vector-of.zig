const std = @import("std");

const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub var vector: @Vector(4, Variant) = .{
    .{ .Float = 1 },
    .{ .Float = 2 },
    .{ .Float = 3 },
    .{ .Float = 4 },
};
pub const vector_const: @Vector(4, void) = .{
    .{ .Float = 1 },
    .{ .Float = 2 },
    .{ .Float = 3 },
    .{ .Float = 4 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
