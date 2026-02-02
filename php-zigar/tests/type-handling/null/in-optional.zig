const std = @import("std");

pub var optional: ?@TypeOf(null) = null;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
