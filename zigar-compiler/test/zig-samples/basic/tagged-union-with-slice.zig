const std = @import("std");

const ValueType = enum { String, Integer, Float };

pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};

pub const variant_a: Variant = .{ .String = "apple" };
pub const variant_b: Variant = .{ .Integer = 123 };
pub const variant_c: Variant = .{ .Float = 3.14 };

pub fn printVariant(arg: Variant) void {
    switch (arg) {
        .String => |s| std.debug.print("{s}\n", .{s}),
        .Integer => |i| std.debug.print("{d}\n", .{i}),
        .Float => |f| std.debug.print("{d}\n", .{f}),
    }
}

pub fn printVariantPtr(arg: *const Variant) void {
    printVariant(arg.*);
}
