const std = @import("std");

pub const Enum = enum { cat, dog };
pub const Union = union(Enum) {
    cat: i32,
    dog: i32,
};

pub const tagged_union: Union = .{ .cat = 1234 };
