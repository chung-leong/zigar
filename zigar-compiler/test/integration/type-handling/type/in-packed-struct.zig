const std = @import("std");

pub const StructA = packed struct {
    Type1: type,
    Type2: type,
    number: u10 = 100,
    Type3: type,
};

pub const struct_a: StructA = .{ .Type1 = u8, .Type2 = u16, .number = 200, .Type3 = u32 };
