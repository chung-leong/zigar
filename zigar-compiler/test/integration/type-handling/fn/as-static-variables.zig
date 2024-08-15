const std = @import("std");

pub var func: ?*const fn () void = hello;

pub fn hello() void {
    std.debug.print("hello\n", .{});
}

pub fn world() void {
    std.debug.print("world\n", .{});
}

pub const hello2 = hello;
pub const hello3 = hello;

pub fn @" \nthis is a totally weird function name!! :-)"() void {
    std.debug.print("Hello world\n", .{});
}
