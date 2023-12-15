const std = @import("std");

pub const array: [4]@TypeOf(.enum_literal) = .{
    .hello,
    .world,
    .dog,
    .cat,
};
