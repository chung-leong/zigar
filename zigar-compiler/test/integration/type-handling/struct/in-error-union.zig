const std = @import("std");

pub const Error = error{ goldfish_died, no_money };
pub const Struct = packed struct {
    number1: i12,
    number2: i12,
};
pub var error_union: Error!Struct = .{ .number1 = 100, .number2 = 200 };

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
