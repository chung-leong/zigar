const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };
pub const Fn = *const fn () void;

fn hello() void {}

pub var error_union: Error!Fn = hello;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
