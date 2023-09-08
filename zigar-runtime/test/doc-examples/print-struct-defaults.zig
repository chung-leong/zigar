// print-struct-defaults.zig
const std = @import("std");

pub const StructA = struct {
    number1: i16 = 1,
    number2: i16 = 2,
};

pub const StructB = struct {
    a: ?StructA = null,
    number3: f64 = 3,
};

pub fn printStruct(s: StructB) void {
    std.debug.print("{any}\n", .{s});
}
