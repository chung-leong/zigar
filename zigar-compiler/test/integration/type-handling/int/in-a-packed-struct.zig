const std = @import("std");

pub const StructA = packed struct {
    number1: i12 = 100,
    number2: i40 = 200,
    state: bool = false,
    number3: i20 = 300,
};

pub var struct_a: StructA = .{ .number1 = 15, .number2 = 777, .state = true, .number3 = -420 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
