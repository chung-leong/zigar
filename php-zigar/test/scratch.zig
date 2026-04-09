const std = @import("std");

pub const Struct = struct {
    number: i32,
    next: *@This(),
};

var s: Struct = undefined;

pub fn get() *Struct {
    s.next = &s;
    s.number = 1234;
    return &s;
}
