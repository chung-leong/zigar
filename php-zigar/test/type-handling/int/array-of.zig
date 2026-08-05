const std = @import("std");

pub var array1: [4]u4 = .{ 1, 2, 3, 4 };
pub var array2: [4]u8 = .{ 1, 2, 3, 4 };
pub var array3: [4]u128 = .{ 1, 2, 3, 4 };

pub fn print1() void {
    std.debug.print("{any}\n", .{array1});
}

pub fn print2() void {
    std.debug.print("{any}\n", .{array2});
}

pub fn print3() void {
    std.debug.print("{any}\n", .{array3});
}
