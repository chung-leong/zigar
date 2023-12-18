const std = @import("std");

pub const array: [4]anyopaque = .{
    opaque {},
    opaque {},
    opaque {},
    opaque {},
};

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
