const std = @import("std");

pub fn print(value: @Vector(4, f64)) void {
    std.debug.print("{any}\n", .{value});
}
