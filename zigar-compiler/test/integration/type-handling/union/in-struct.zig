const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub const StructA = struct {
    variant1: Variant = .{ .string = "world" },
    variant2: Variant = .{ .float = 3.14 },
};

pub var variant_a: StructA = .{ .variant1 = .{ .float = 7.777 }, .variant2 = .{ .string = "Hello" } };

pub fn print() void {
    std.debug.print("{any}\n", .{variant_a});
}
