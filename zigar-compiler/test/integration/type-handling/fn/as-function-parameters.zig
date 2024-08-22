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

pub fn call2(cb: *const fn () error{unexpected}!void) !void {
    try cb();
}

pub fn call3(cb: *const fn (i32) i32) i32 {
    return cb(1234);
}
