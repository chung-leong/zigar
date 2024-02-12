const std = @import("std");

pub fn print4(values: [4]i32) void {
    std.debug.print("{d}\n", .{values});
}
