const std = @import("std");

pub const StructA = struct {
    number: i32,
    comptime vector: @Vector(4, i32) = .{ 1, 2, 3, 4 },
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
