const std = @import("std");

pub fn print8(number: i8) void {
    std.debug.print("number = {d}\n", .{number});
}
