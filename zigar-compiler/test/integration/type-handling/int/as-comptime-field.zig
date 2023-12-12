const std = @import("std");

pub const StructA = struct {
    state: bool,
    comptime number: i32 = 5000,
};

pub var struct_a: StructA = .{ .state = true };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
