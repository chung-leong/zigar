const std = @import("std");

pub fn set(ptr1: *i16, ptr2: *i32) void {
    ptr2.* = 0x22222222;
    ptr1.* = 0x1111;
}
