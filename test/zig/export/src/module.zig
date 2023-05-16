const std = @import("std");

pub const a: i32 = 1;

const b: i32 = 2;

pub var c: bool = true;

pub const d: f64 = 3.14;

pub const e: [4]i32 = .{ 3, 4, 5, 6 };

pub const f = enum { Dog, Cat, Chicken };

pub const g = enum(c_int) { Dog = -100, Cat, Chicken };

pub fn h(arg1: i32, arg2: i32) bool {
    return arg1 < arg2;
}

pub fn i(alloc: std.mem.Allocator, arg1: i32, arg2: i32) bool {
    _ = alloc;
    return arg1 < arg2;
}
