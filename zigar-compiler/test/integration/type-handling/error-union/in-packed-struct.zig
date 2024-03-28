const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub const StructA = packed struct {
    number1: Error!i12 = Error.goldfish_died,
    number2: Error!i40 = 200,
    state: bool = false,
    number3: Error!i20 = 300,
};

pub var struct_a: StructA = .{ .number1 = 15, .number2 = Error.goldfish_died, .state = true, .number3 = Error.no_money };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
