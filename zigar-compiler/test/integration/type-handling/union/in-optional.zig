const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub var optional: ?Variant = .{ .integer = 100 };

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
