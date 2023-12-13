const std = @import("std");

pub const optional1: ?type = bool;
pub const optional2: ?type = null;

pub fn print() void {
    std.debug.print("{any}\n", .{optional1});
}
