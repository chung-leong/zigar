const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub var array: [4]Error!i32 = .{ 1, 2, Error.NoMoney, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
