const std = @import("std");

pub const Error = error{ goldfish_died, no_money };
const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};
pub var error_union: Error!Variant = .{ .integer = 100 };

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
