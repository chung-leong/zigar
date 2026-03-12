const std = @import("std");

pub const StructA = struct {
    number: i32,
    comptime text: []const u8 = "Hello",
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
