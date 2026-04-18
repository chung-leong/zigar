const std = @import("std");

pub const Test = struct {
    number: i32,
};

pub const Pointer = *Test;
