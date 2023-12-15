const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {}

pub var optional: ?Fn = hello;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
