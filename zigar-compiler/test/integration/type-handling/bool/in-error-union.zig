const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var error_union: Error!bool = true;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
