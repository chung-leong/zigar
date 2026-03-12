const std = @import("std");

pub var vector: @Vector(4, ?u8) = .{ 1, 2, null, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
