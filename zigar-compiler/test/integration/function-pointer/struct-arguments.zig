const std = @import("std");

const A = struct {
    number1: usize,
    number2: usize,
};

const B = struct {
    a: A,
    comptime b: f64 = std.math.pi,
};

pub fn call(f: *const fn (b: B) A) A {
    return f(.{
        .a = .{ .number1 = 123, .number2 = 456 },
    });
}
