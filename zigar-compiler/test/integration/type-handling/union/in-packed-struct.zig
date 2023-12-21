const std = @import("std");

const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub const StructA = packed struct {
    variant1: Variant = .{ .String = "world" },
    variant2: Variant = .{ .Float = 3.14 },
    number: u10 = 100,
    variant3: Variant = .{ .Integer = 200 },
};

pub var variant_a: StructA = .{
    .variant1 = .{ .Float = 7.777 },
    .variant2 = .{ .String = "Hello" },
    .number = 200,
    .variant3 = .{ .Integer = 123 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{variant_a});
}
