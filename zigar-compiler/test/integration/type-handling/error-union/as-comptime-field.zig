const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub const StructA = struct {
    state: bool,
    comptime number1: Error!i32 = 5000,
    comptime number2: Error!i32 = Error.goldfish_died,
};

pub var struct_a: StructA = .{ .state = true };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
