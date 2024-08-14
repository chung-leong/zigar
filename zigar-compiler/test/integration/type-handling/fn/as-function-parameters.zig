const std = @import("std");

pub fn hello() void {
    std.debug.print("hello\n", .{});
}

pub fn world() void {
    std.debug.print("world\n", .{});
}

pub fn call1(cb: *const fn () void) void {
    cb();
}
