const std = @import("std");

pub var optional: ?@TypeOf(undefined) = undefined;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
