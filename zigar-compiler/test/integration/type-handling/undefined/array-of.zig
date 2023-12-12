const std = @import("std");

pub const array: [4]undefined = .{ undefined, undefined, undefined, undefined };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
