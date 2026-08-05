const std = @import("std");

pub const StructA = struct {
    state1: bool = true,
    state2: bool = false,
};

pub var struct_a: StructA = .{ .state1 = false, .state2 = true };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
