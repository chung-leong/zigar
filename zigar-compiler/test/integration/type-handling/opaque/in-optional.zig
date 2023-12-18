const std = @import("std");

pub var optional: ?anyopaque = opaque {};

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
