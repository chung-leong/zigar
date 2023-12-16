const std = @import("std");

pub var func: ?*const fn () void = hello;

pub fn hello() void {}

pub const hello2 = hello;
pub const hello3 = hello;

pub fn @" \nthis is a totally weird function name!! :-)"() void {
    std.debug.print("Hello world\n", .{});
}
