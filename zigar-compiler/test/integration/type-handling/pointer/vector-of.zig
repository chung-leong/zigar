const std = @import("std");

var number: u32 = 1;
pub var vector: @Vector(4, *u32) = .{ &number, &number, &number, &number };
pub const vector_const: @Vector(4, *u32) = .{ &number, &number, &number, &number };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
