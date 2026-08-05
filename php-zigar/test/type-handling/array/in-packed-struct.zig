const std = @import("std");

pub const StructA = packed struct {
    array1: [4]i32 = .{ 1, 2, 3, 4 },
    array2: [4]i32 = .{ 2, 3, 4, 5 },
    number: u10 = 100,
    array3: [4]i32 = .{ 3, 4, 5, 6 },
};

pub var struct_a: StructA = .{
    .array1 = .{ 10, 20, 30, 40 },
    .array2 = .{ 11, 21, 31, 41 },
    .number = 200,
    .array3 = .{ 12, 22, 32, 42 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
