const std = @import("std");

pub const StructA = struct {
    literal1: @TypeOf(.enum_literal),
    literal2: @TypeOf(.enum_literal),
};

pub const struct_a: StructA = .{ .literal1 = .hello, .literal2 = .world };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
