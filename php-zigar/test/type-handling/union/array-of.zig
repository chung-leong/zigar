const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub var array: [4]Variant = .{
    .{ .integer = 123 },
    .{ .float = 1.23 },
    .{ .string = "world" },
    .{ .integer = 777 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
