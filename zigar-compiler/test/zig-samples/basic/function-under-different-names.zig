const std = @import("std");

pub fn hello1() void {
    std.debug.print("Hello world\n", .{});
}

pub const hello2 = hello1;
pub const hello3 = hello1;
