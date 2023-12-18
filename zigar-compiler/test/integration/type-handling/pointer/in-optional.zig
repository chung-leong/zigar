const std = @import("std");

pub var optional: ?[]const u8 = "Hello";
pub var alt_text: []const u8 = "World";

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
