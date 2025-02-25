const std = @import("std");

pub var number: i32 = 4567;

pub fn printVariable() void {
    std.debug.print("number = {d} (Zig)\n", .{number});
}

pub fn changeVariable(value: i32) void {
    number = value;
}
