const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub var error_union: Error!f64 = 3.14;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
