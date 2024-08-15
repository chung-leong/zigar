const std = @import("std");

pub const Error = error{ goldfish_died, no_money };
pub const Fn = *const fn () void;

fn hello() void {
    std.debug.print("hello", .{});
}

fn world() void {
    std.debug.print("world", .{});
}

pub var error_union: Error!Fn = hello;

pub fn getFunction(index: usize) Error!Fn {
    return switch (index) {
        0 => hello,
        1 => world,
        2 => Error.goldfish_died,
        else => Error.no_money,
    };
}
