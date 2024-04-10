const std = @import("std");

pub const Number = extern union {
    integer: i32,
    big_integer: i64,
    decimal: f64,
};

pub const a: Number = .{ .integer = 123 };
pub const b: Number = .{ .big_integer = 1234567890 };
pub const c: Number = .{ .decimal = 0.12345 };
