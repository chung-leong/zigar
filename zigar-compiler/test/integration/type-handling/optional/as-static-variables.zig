const std = @import("std");

pub var i32_empty: ?i32 = null;
pub var i32_value: ?i32 = 1234;

pub var bool_empty: ?bool = null;
pub var bool_value: ?bool = true;

pub const f64_empty: ?f64 = null;
pub const f64_value: ?f64 = 3.14;

pub fn print() void {
    std.debug.print("{?d}\n", .{i32_value});
}
