const std = @import("std");

pub fn print(s: []const u8) void {
    std.debug.print("Text: {s}\n", .{s});
}
