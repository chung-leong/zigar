const std = @import("std");

var int: i32 = 123;

pub fn get() ?*i32 {
    return &int;
}
