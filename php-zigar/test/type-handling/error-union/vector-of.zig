const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub var vector: @Vector(4, Error!u8) = .{ 1, 2, Error.GoldfishDied, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
