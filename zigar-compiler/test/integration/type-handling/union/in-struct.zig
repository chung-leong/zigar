const std = @import("std");

const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub const StructA = struct {
    variant1: Variant = .{ .String = "world" },
    variant2: Variant = .{ .Float = 3.14 },
};

pub var variant_a: StructA = .{ .variant1 = .{ .Float = 7.777 }, .variant2 = .{ .String = "Hello" } };

pub fn print() void {
    std.debug.print("{any}\n", .{variant_a});
}
