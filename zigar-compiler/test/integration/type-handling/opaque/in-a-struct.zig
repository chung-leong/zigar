const std = @import("std");

pub const StructA = struct {
    opaque1: anyopaque = opaque {},
    opaque2: anyopaque = opaque {},
};

pub var struct_a: StructA = .{ .opaque1 = opaque {}, .opaque2 = opaque {} };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
