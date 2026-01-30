const std = @import("std");

pub var optional: ?bool = true;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
