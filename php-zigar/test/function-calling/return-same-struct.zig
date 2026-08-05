const std = @import("std");

pub const Struct = struct {
    number1: i32,
    number2: i32,
};

pub fn echo(ptr: *Struct) *Struct {
    return ptr;
}
