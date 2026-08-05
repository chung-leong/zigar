const std = @import("std");

pub fn print(value: bool) void {
    std.debug.print("{s}\n", .{if (value) "yes" else "no"});
}
