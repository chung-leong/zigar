const std = @import("std");

pub const i32_type = i32;
pub const i64_type = i64;
pub const number: i32 = 1234;
pub const comptime_number = 1234;
pub const array: [4]i32 = .{ 1, 2, 3, 4 };
pub const name = "Hello world!";

pub var another: i32 = 0;
pub var array_variable: [4]i32 = .{ 4, 3, 2, 1 };

pub fn hello(n: i32) void {
    std.debug.print("number = {d}\n", .{n});
}
