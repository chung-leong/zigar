const std = @import("std");

pub var text: []const u8 = "Hello world";

pub fn printText() void {
  std.debug.print("{s}\n", .{ text });
}
