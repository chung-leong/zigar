const std = @import("std");

pub const StructA = struct {
    text1: []const u8 = "apple",
    text2: []const u8 = "orange",
};

pub var struct_a: StructA = .{ .text1 = "dog", .text2 = "cat" };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
