const std = @import("std");

pub fn print(value: anyopaque) void {
    std.debug.print("{any}\n", .{value});
}
