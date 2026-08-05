const std = @import("std");
pub const Fn = *const fn () void;

fn hello() void {
    std.debug.print("hello\n", .{});
}

pub fn getFunction() Fn {
    return hello;
}
