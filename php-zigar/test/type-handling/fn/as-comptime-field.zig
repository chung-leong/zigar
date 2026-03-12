const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {}

pub const StructA = struct {
    number: i32,
    comptime function: Fn = hello,
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
