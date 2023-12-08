const std = @import("std");

pub var int32_array4: [4]i32 = .{ 1, 2, 3, 4 };
pub const float64_array4x4: [4][4]f64 = .{
    .{ 1.1, 1.2, 1.3, 1.4 },
    .{ 2.1, 2.2, 2.3, 2.4 },
    .{ 3.1, 3.2, 3.3, 3.4 },
    .{ 4.1, 4.2, 4.3, 4.4 },
};

pub fn print1() void {
    std.debug.print("{d}", .{int32_array4});
}

const StructA = struct {
    number1: i32,
    number2: i32,
};

const StructB = struct {
    good: bool,
    numbers: [4]i32,
};

pub const array_a: [4]StructA = .{
    .{ .number1 = 1, .number2 = 2 },
    .{ .number1 = 3, .number2 = 4 },
    .{ .number1 = 5, .number2 = 6 },
    .{ .number1 = 7, .number2 = 8 },
};

pub const array_b: [3]StructB = .{
    .{ .good = true, .numbers = .{ 1, 2, 3, 4 } },
    .{ .good = false, .numbers = .{ 3, 4, 5, 6 } },
    .{ .good = false, .numbers = .{ 2, 2, 7, 7 } },
};

pub var array_c: [2]StructA = .{
    .{ .number1 = 1, .number2 = 2 },
    .{ .number1 = 3, .number2 = 4 },
};

pub fn print2() void {
    std.debug.print("{any}", .{array_c});
}
