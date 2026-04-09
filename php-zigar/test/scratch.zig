const std = @import("std");

pub const Struct = struct {
    number: i32,
    next: *@This(),
};
// pub const something: Enum = .cow;
