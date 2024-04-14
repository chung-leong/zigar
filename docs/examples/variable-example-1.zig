const std = @import("std");

pub const numeric_constant: i32 = 1234;
pub var numeric_variable: i32 = 43;

pub fn printNumericVariable() void {
    std.debug.print("From Zig: {d}\n", .{numeric_variable});
}
