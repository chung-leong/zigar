const std = @import("std");

pub const StructA = struct {
    empty1: void = {},
    empty2: void = {},
};

pub var struct_a: StructA = .{ .empty1 = {}, .empty2 = {} };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
