const std = @import("std");

pub const StructA = struct {
    array1: [4]i32 = .{ 1, 2, 3, 4 },
    array2: [4]i32 = .{ 5, 6, 7, 8 },
};

pub var struct_a: StructA = .{
    .array1 = .{ 10, 20, 30, 40 },
    .array2 = .{ 11, 21, 31, 41 },
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
