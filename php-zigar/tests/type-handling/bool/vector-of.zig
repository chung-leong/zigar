const std = @import("std");

pub var vector: @Vector(4, bool) = .{ true, false, false, true };
pub const vector_const: @Vector(4, bool) = .{ false, false, false, false };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
