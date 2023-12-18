const std = @import("std");

pub const StructA = struct {
    number1: ?i32 = 123,
    number2: ?i64 = null,
};

pub var struct_a: StructA = .{ .number1 = null, .number2 = -444 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
