const std = @import("std");

pub var array1: [4]f16 = .{ 1.25, 2.25, 3.25, 4.25 };
pub var array2: [4]f64 = .{ 1.1, 2.1, 3.1, 4.1 };
pub var array3: [4]f128 = .{ 1.1, 2.1, 3.1, 4.1 };

pub fn print1() void {
    std.debug.print("{any}\n", .{array1});
}

pub fn print2() void {
    std.debug.print("{any}\n", .{array2});
}

pub fn print3() void {
    std.debug.print("{any}\n", .{array3});
}
