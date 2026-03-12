const std = @import("std");

pub fn print(comptime arg: comptime_float) void {
    std.debug.print("{d}\n", .{arg});
}
