const std = @import("std");

pub const StructA = packed struct {
    empty1: @TypeOf(null) = null,
    empty2: @TypeOf(null) = null,
    number: u10 = 100,
    empty3: @TypeOf(null) = null,
};

pub var struct_a: StructA = .{ .empty1 = null, .empty2 = null, .number = 200, .empty3 = null };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
