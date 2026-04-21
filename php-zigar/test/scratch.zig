const std = @import("std");

pub var array: [4]bool = .{ true, false, false, true };
pub const array_const: [4]bool = .{ false, false, false, false };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
