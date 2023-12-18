const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub const StructA = struct {
    number1: Error!i32 = 123,
    number2: Error!i64 = Error.NoMoney,
};

pub var struct_a: StructA = .{ .number1 = Error.GoldfishDied, .number2 = -444 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
