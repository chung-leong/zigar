const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var vector: @Vector(4, Error!u8) = .{ 1, 2, Error.goldfish_died, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
