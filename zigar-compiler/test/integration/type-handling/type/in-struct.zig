const std = @import("std");

pub const StructA = struct {
    Type1: type,
    Type2: type,
};

pub const struct_a: StructA = .{ .Type1 = u8, .Type2 = u16 };
