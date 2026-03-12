const std = @import("std");

pub const StructA = packed struct {
    number1: ?i12 = null,
    number2: ?i40 = 200,
    state: bool = false,
    number3: ?i20 = 300,
};

pub var struct_a: StructA = .{ .number1 = 15, .number2 = null, .state = true, .number3 = null };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
