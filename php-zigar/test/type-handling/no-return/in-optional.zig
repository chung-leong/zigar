const std = @import("std");

pub var optional: ?noreturn = unreachable;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
