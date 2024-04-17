const std = @import("std");

pub fn hello() void {
    std.debug.print("hello\n", .{});
}
