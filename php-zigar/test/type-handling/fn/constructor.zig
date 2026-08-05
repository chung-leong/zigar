const std = @import("std");

pub const FunctionA = fn (i32, i64) bool;
pub const FunctionAPtr = *const fn (i32, i64) bool;
pub const FunctionB = fn (i32) bool;

pub fn hello() void {
    std.debug.print("Hello world!\n", .{});
}
