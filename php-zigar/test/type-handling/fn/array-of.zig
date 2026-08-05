const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {
    std.debug.print("hello", .{});
}

fn world() void {
    std.debug.print("world", .{});
}

pub const array: [4]Fn = .{
    hello,
    hello,
    world,
    hello,
};

pub fn getFunctions() [4]Fn {
    return .{
        world,
        world,
        hello,
        world,
    };
}
