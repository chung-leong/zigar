const std = @import("std");

pub const Fn = *const fn () void;

fn hello() void {
    std.debug.print("hello", .{});
}

fn world() void {
    std.debug.print("world", .{});
}

pub const StructA = struct {
    function1: Fn = hello,
    function2: Fn = world,
    number: i32 = 1234,
};

pub var struct_a: StructA = .{};

pub fn getStruct() StructA {
    return .{
        .function1 = world,
        .function2 = hello,
        .number = 4567,
    };
}
