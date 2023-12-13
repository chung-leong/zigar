const std = @import("std");

pub const StructA = packed struct {
    empty1: noreturn = unreachable,
    empty2: noreturn = unreachable,
    number: u10 = 100,
    empty3: noreturn = unreachable,
};

pub var struct_a: StructA = .{ .empty1 = unreachable, .empty2 = unreachable, .number = 200, .empty3 = unreachable };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
