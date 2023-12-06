const std = @import("std");

pub fn print() void {
    std.debug.print("Hello world", .{});
}
