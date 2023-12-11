const std = @import("std");

pub fn print(value: void) void {
    std.debug.print("{any}\n", .{value});
}
