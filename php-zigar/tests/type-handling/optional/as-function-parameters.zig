const std = @import("std");

pub fn print(value: ?i32) void {
    std.debug.print("{any}\n", .{value});
}
