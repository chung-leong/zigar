// area.zig
const std = @import("std");

pub fn getArea(radius: f64) f64 {
    return radius * radius * std.math.pi;
}

pub fn getOpposite(value: bool) bool {
    return !value;
}
