const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub const StructA = packed struct {
    number1: Error!i12 = Error.GoldfishDied,
    number2: Error!i40 = 200,
    state: bool = false,
    number3: Error!i20 = 300,
};

pub var struct_a: StructA = .{ .number1 = 15, .number2 = Error.GoldfishDied, .state = true, .number3 = Error.NoMoney };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
