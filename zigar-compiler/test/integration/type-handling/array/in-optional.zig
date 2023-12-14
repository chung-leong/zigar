const std = @import("std");

pub var optional: ?[4]i32 = .{ 1, 2, 3, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
