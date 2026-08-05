const std = @import("std");

pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};
pub const StructA = struct {
    number: i32,
    comptime structure: Struct = .{ .number1 = 100, .number2 = 200 },
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
