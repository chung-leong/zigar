const std = @import("std");

pub const StructA = packed struct {
    state1: bool = true,
    state2: bool = false,
    number: u10 = 100,
    state3: bool = false,
};

pub var struct_a: StructA = .{ .state1 = false, .state2 = true, .number = 200, .state3 = true };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
