const std = @import("std");

pub const float16_const: f16 = -44.4;
pub var float16: f16 = 0.44;
pub const float32_const: f32 = 0.1234;
pub var float32: f32 = 34567.56;
pub var float64: f64 = std.math.pi;
pub var float80: f80 = std.math.pi;
pub var float128: f128 = std.math.pi;

pub fn print() void {
    std.debug.print("{d}\n", .{float64});
}
