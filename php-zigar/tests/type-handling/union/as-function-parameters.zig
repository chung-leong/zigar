const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};

pub fn print(value: Variant) void {
    std.debug.print("{any}\n", .{value});
}
