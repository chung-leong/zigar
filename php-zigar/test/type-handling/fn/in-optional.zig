const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {
    std.debug.print("hello", .{});
}

fn world() void {
    std.debug.print("world", .{});
}

pub var optional: ?Fn = hello;

pub fn getFunction(index: usize) ?Fn {
    return switch (index) {
        0 => hello,
        1 => world,
        else => null,
    };
}
