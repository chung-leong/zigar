const std = @import("std");

pub const Struct = struct {
    number1: i32 = 123,
    number2: i32 = 456,
};

pub var struct_var: Struct = .{ .number1 = 789 };

pub fn print() void {
    std.debug.print("{}\n", .{struct_var});
}
