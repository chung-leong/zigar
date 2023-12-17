const std = @import("std");

pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};
pub const StructA = packed struct {
    struct1: Struct = .{ .number1 = 10, .number2 = 20 },
    struct2: Struct = .{ .number1 = 11, .number2 = 21 },
    number: u10 = 100,
    struct3: Struct = .{ .number1 = 12, .number2 = 22 },
};

pub var struct_a: StructA = .{
    .struct1 = .{ .number1 = 1, .number2 = 2 },
    .struct2 = .{ .number1 = 3, .number2 = 4 },
    .number = 200,
    .struct3 = .{ .number1 = 5, .number2 = 6 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
