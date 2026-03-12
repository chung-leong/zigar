const std = @import("std");

pub const Uint8 = u8;
pub const Uint16 = u16;

pub const StructA = struct {
    Type1: type,
    Type2: type,
};

pub const struct_a: StructA = .{ .Type1 = u8, .Type2 = u16 };

pub fn print() void {
    std.debug.print("{any}", .{struct_a});
}
