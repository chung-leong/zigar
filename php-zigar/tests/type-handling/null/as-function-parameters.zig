const std = @import("std");

pub fn print(comptime value: @TypeOf(null)) void {
    std.debug.print("{any}\n", .{value});
}
