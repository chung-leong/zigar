const std = @import("std");

pub fn print(value: []const u8) void {
    std.debug.print("{s}\n", .{value});
}
