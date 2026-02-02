const std = @import("std");

const Struct = struct {
    number1: f32 = 1,
    number2: f32 = 2,
};
pub var vector: @Vector(4, Struct) = .{ .{}, .{}, .{}, .{} };
pub const vector_const: @Vector(4, void) = .{ .{}, .{}, .{}, .{} };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
