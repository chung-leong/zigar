const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub const StructA = struct {
    number1: Error!i32 = 123,
    number2: Error!i64 = Error.no_money,
};

pub var struct_a: StructA = .{ .number1 = Error.goldfish_died, .number2 = -444 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
