const std = @import("std");

pub const StructA = struct {
    number: i32,
    comptime literal: @TypeOf(.enum_literal) = .hello,
};

pub const struct_a: StructA = .{ .number = 123 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
