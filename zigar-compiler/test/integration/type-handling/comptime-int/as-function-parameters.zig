const std = @import("std");

pub fn print(comptime arg: comptime_int) void {
    std.debug.print("{d}\n", .{arg});
}
