const std = @import("std");

pub const array: [4]void = .{ {}, {}, {}, {} };

pub var array_writable: [4]void = .{ {}, {}, {}, {} };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
