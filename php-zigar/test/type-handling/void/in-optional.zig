const std = @import("std");

pub var optional: ?void = {};

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
