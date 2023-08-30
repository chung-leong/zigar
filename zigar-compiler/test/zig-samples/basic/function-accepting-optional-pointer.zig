const std = @import("std");

pub fn printName(name: ?[]const u8) void {
    std.debug.print("{s}\n", .{ name orelse "Anonymous" });
}
