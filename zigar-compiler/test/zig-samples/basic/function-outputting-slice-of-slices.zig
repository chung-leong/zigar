const std = @import("std");

pub fn print(lines: []const []const u8) void {
    for (lines) |line| {
        std.debug.print("{s}\n", .{line});
    }
}
