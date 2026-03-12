const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub var error_union: Error!bool = true;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
