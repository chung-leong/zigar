const std = @import("std");

pub const StructA = packed struct(u32) {
    apple: bool = false,
    banana: bool = false,
    cantaloupe: bool = false,
    durian: bool = false,
    _: u28 = 0,
};
