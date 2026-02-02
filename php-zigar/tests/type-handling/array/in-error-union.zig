const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub var error_union: Error![4]i32 = .{ 1, 2, 3, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
