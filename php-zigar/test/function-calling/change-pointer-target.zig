const std = @import("std");

var odd: i32 = 123;
var even: i32 = 456;

pub var number_ptr: *i32 = &odd;

pub fn change(use_even: bool) void {
    if (use_even) {
        number_ptr = &even;
    } else {
        number_ptr = &odd;
    }
}

pub fn print() void {
    std.debug.print("odd = {d}, even = {d}\n", .{ odd, even });
}
