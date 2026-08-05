const std = @import("std");

pub const array: [2][4]i32 = .{
    .{ 1, 2, 3, 4 },
    .{ 2, 3, 4, 5 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
