const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub var vector: @Vector(4, Variant) = .{
    .{ .float = 1 },
    .{ .float = 2 },
    .{ .float = 3 },
    .{ .float = 4 },
};
pub const vector_const: @Vector(4, void) = .{
    .{ .float = 1 },
    .{ .float = 2 },
    .{ .float = 3 },
    .{ .float = 4 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
