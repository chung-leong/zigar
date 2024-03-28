const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub const error_union1: Error!type = bool;
pub const error_union2: Error!type = Error.goldfish_died;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union1});
}
