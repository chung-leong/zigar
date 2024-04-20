const std = @import("std");

pub const Struct = struct {
    number1: i32,
    number2: i32,
};

pub const constant: Struct = .{ .number1 = 123, .number2 = 456 };
pub var variable: Struct = .{ .number1 = 1, .number2 = 2 };

pub const comptime_struct = struct {
    pub const input = .{
        .src = .{ .channels = 4 },
    };
};

pub const tuple = .{ 123, 3.14, .evil };

pub fn print() void {
    std.debug.print("{any}\n", .{variable});
}
