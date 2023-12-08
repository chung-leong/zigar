const std = @import("std");

pub const StructA = struct {
    number1: i32,
    number2: i32,
};

pub const constant: StructA = .{ .number1 = 123, .number2 = 456 };
pub var variable: StructA = .{ .number1 = 1, .number2 = 2 };

pub const comptime_struct = struct {
    pub const input = .{
        .src = .{ .channels = 4 },
    };
};

pub fn print() void {
    std.debug.print("{any}\n", .{variable});
}
