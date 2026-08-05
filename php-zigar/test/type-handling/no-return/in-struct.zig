const std = @import("std");

pub const StructA = struct {
    empty1: noreturn = unreachable,
    empty2: noreturn = unreachable,
};

pub var struct_a: StructA = .{ .empty1 = unreachable, .empty2 = unreachable };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
