const std = @import("std");

pub var array: [4]i32 = .{ 1, 2, 3, 4 };

pub fn printArray() void {
    std.debug.print("array = {d} (Zig)\n", .{array});
}

pub fn changeArray(index: usize, value: i32) void {
    array[index] = value;
}
