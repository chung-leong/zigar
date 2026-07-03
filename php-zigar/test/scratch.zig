const std = @import("std");

pub fn hello() void {
    std.debug.print("Hello world\n", .{});
}

pub const hello1 = hello;
