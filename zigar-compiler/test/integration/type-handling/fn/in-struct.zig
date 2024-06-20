const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {}

pub const StructA = struct {
    function1: Fn = hello,
    function2: Fn = hello,
    number: i32 = 1234,
};

pub var struct_a: StructA = .{};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
