const std = @import("std");

pub fn print(comptime value: type) void {
    std.debug.print("{any}\n", .{value});
}
