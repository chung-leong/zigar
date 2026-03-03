const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {
    std.debug.print("hello\n", .{});
}

fn world() void {
    std.debug.print("world\n", .{});
}

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

pub fn change(n: i32) void {
    if (n == 1) {
        vector = .{
            hello,
            hello,
            hello,
            hello,
        };
    } else if (n == 2) {
        vector = .{
            world,
            world,
            world,
            world,
        };
    }
}
