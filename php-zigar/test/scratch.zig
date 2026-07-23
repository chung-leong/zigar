const std = @import("std");
pub const pi = std.math.pi;

pub var number: i32 = 123;

pub const Point = struct {
    x: f64,
    y: f64,
};

pub fn hello() void {
    std.debug.print("Hello world\n", .{});
}
