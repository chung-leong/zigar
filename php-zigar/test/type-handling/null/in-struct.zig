const std = @import("std");

pub const StructA = struct {
    empty1: @TypeOf(null) = null,
    empty2: @TypeOf(null) = null,
    hello: i32 = 1234,
};

pub const struct_a: StructA = .{ .empty1 = null, .empty2 = null };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
