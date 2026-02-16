const std = @import("std");

pub var bigint: i128 = 0x12345678900000;

pub fn print() void {
    std.debug.print("bigint = {d}\n", .{bigint});
}
