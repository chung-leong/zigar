const std = @import("std");

pub const Apple = opaque {};
pub const Orange = opaque {};
var number: i32 = 1234;

pub var int_ptr = &number;
pub var orange_ptr: *Orange = @ptrCast(&number);

pub fn compare(p1: *const anyopaque, p2: *const anyopaque) bool {
    return p1 == p2;
}
