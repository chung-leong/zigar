const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub const error_union: Error!@TypeOf(.enum_literal) = .hello;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
