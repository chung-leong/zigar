const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub const error_union1: Error!noreturn = unreachable;
pub const error_union2: Error!noreturn = Error.GoldfishDied;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union1});
}
