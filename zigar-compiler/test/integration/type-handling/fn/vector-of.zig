const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {}

pub var vector: @Vector(4, Fn) = .{
    hello,
    hello,
    hello,
    hello,
};
pub const vector_const: @Vector(4, Fn) = .{
    hello,
    hello,
    hello,
    hello,
};

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
