const std = @import("std");

pub const optional: ?@TypeOf(.enum_literal) = .hello;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
