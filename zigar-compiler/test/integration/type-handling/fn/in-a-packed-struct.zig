const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {}

pub const StructA = packed struct {
    function1: Fn = hello,
    function2: Fn = hello,
    number: u10 = 100,
    function3: Fn = hello,
};

pub var struct_a: StructA = .{ .number = 200 };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
