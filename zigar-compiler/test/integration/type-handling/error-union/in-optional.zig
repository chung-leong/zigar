const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub var optional: ?Error!i32 = 3000;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
