const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var error_union: Error!@Vector(4, i32) = .{ 1, 2, 3, 4 };

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
