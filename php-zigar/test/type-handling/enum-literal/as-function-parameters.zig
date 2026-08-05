const std = @import("std");

pub fn print(comptime value: @TypeOf(.enum_literal)) void {
    std.debug.print("{any}\n", .{value});
}
