const std = @import("std");

pub fn print(comptime value: noreturn) void {
    std.debug.print("{any}\n", .{value});
}
