const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {}

pub const array: [4]Fn = .{
    hello,
    hello,
    hello,
    hello,
};

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
