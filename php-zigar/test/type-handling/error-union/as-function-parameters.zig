const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub fn print(value: Error!i32) void {
    std.debug.print("{any}\n", .{value});
}
