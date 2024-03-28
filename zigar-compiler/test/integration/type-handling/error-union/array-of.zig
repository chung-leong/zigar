const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var array: [4]Error!i32 = .{ 1, 2, Error.no_money, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
