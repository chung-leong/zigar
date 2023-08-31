const std = @import("std");

pub const ValueType = enum { String, Integer, Float };

pub const Variant = union(ValueType) {
    String: []const u8,
    Integer: u32,
    Float: f64,
};

pub const Donut = enum { Jelly, Chocolate };

pub const DonutValue = union(Donut) {
    Jelly: Variant,
    Chocolate: u32,
};

pub var donut_a: DonutValue = .{
    .Jelly = .{
        .String = "Hello world",
    },
};
pub var donut_b: DonutValue = .{
    .Chocolate = 1234,
};
