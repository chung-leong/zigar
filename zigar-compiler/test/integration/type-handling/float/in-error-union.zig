const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var error_union: Error!f64 = 3.14;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
