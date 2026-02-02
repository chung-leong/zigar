const std = @import("std");

pub const StructA = packed struct {
    literal1: @TypeOf(.enum_literal),
    literal2: @TypeOf(.enum_literal),
    number: u10 = 100,
    literal3: @TypeOf(.enum_literal),
};

pub const struct_a: StructA = .{ .literal1 = .hello, .literal2 = .world, .number = 200, .literal3 = .donut };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
