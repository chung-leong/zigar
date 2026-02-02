const std = @import("std");

pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};

pub fn print(value: Struct) void {
    std.debug.print("{any}\n", .{value});
}
