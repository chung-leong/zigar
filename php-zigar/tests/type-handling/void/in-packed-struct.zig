const std = @import("std");

pub const StructA = packed struct {
    empty1: void = {},
    empty2: void = {},
    number: u10 = 100,
    empty3: void = {},
};

pub var struct_a: StructA = .{ .empty1 = {}, .empty2 = {}, .number = 200, .empty3 = {} };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
