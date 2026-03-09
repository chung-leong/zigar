const std = @import("std");

pub const StructA = packed struct {
    text1: []const u8 = "1 apple",
    text2: []const u8 = "2 oranges",
    number: u10 = 100,
    text3: []const u8 = "3 bananas",
};

pub var struct_a: StructA = .{
    .text1 = "dog",
    .text2 = "cat",
    .number = 200,
    .text3 = "monkey",
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
