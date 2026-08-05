const std = @import("std");

pub const Struct = extern struct {
    number1: i16,
    number2: i16,
};
pub var optional: ?Struct = .{ .number1 = 100, .number2 = 200 };

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
