const std = @import("std");

pub const Value = union {
    string: []const u8,
    integer: u32,
    float: f64,
};

const ValueType = enum { String, Integer, Float };

pub const Variant = struct {
    type: ValueType,
    value: Value,
};

pub const variant_a: Variant = .{
    .type = .String,
    .value = .{ .string = "apple" },
};
pub const variant_b: Variant = .{
    .type = .Integer,
    .value = .{ .integer = 123 },
};
pub const variant_c: Variant = .{
    .type = .Float,
    .value = .{ .float = 3.14 },
};

pub fn printVariant(arg: Variant) void {
    switch (arg.type) {
        .String => std.debug.print("{s}\n", .{arg.value.string}),
        .Integer => std.debug.print("{d}\n", .{arg.value.integer}),
        .Float => std.debug.print("{d}\n", .{arg.value.float}),
    }
}

pub fn printVariantPtr(arg: *const Variant) void {
    printVariant(arg.*);
}
