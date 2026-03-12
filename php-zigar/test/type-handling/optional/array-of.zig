const std = @import("std");

pub var array: [4]?i32 = .{ 1, 2, null, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
