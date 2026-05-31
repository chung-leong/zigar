const std = @import("std");

pub fn print(numbers: []const i32) void {
    for (numbers) |n| std.debug.print("{d}\n", .{n});
}
