const std = @import("std");

pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};
pub const StructA = struct {
    struct1: Struct = .{ .number1 = 10, .number2 = 20 },
    struct2: Struct = .{ .number1 = 11, .number2 = 21 },
};

pub var struct_a: StructA = .{ .struct1 = .{ .number1 = 1, .number2 = 2 }, .struct2 = .{ .number1 = 3, .number2 = 4 } };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
