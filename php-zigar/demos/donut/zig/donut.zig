const std = @import("std");

extern fn main(c_int, [*c][*c]u8) c_int;

pub fn run() void {
    _ = main(0, null);
}
