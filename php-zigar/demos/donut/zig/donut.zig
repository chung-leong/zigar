const std = @import("std");

extern fn c_main(c_int, [*c][*c]u8) c_int;

pub fn run() void {
    _ = c_main(0, null);
}
