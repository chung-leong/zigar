const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };
const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub var error_union: Error!Variant = .{ .Integer = 100 };

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
