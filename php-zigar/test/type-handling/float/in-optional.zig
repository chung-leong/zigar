const std = @import("std");

pub var optional: ?f64 = 3.14;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
