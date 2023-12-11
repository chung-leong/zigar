const std = @import("std");

pub const array: [4]void = .{ {}, {}, {}, {} };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
