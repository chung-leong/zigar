const std = @import("std");

const ValueType = enum { String, Integer, Float };
pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};
pub var optional: ?Variant = .{ .Integer = 100 };

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
