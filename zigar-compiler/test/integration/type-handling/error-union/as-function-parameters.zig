const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub fn print(value: Error!i32) void {
    std.debug.print("{any}\n", .{value});
}
