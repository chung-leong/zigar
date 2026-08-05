const std = @import("std");

pub fn print(comptime value: @TypeOf(undefined)) void {
    std.debug.print("{any}\n", .{value});
}
