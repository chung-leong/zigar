const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub const StructA = packed struct {
    variant1: Variant = .{ .string = "world" },
    variant2: Variant = .{ .float = 3.14 },
    number: u10 = 100,
    variant3: Variant = .{ .integer = 200 },
};

pub var variant_a: StructA = .{
    .variant1 = .{ .float = 7.777 },
    .variant2 = .{ .string = "Hello" },
    .number = 200,
    .variant3 = .{ .integer = 123 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{variant_a});
}
