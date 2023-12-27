const std = @import("std");

pub const U1 = union {
    a: u32,
    b: u32,
    c: comptime_int,
};

const union1: U1 = .{ .c = 1234 };

pub fn main() void {
    const bytes = std.mem.asBytes(&union1);
    const array = bytes.*;
    std.debug.print("{d}\n", .{array});
}
