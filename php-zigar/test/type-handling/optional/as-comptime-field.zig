const std = @import("std");

pub const StructA = struct {
    state: bool,
    comptime number1: ?i32 = 5000,
    comptime number2: ?i32 = null,
};

pub var struct_a: StructA = .{ .state = true };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
