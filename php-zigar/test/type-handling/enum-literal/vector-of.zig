const std = @import("std");

pub var vector: @Vector(4, @TypeOf(.enum_literal)) = .{ .cat, .dog, .monkey, .cow };
pub const vector_const: @Vector(4, @TypeOf(.enum_literal)) = .{ .cat, .dog, .monkey, .cow };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
