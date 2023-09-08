// print-struct.zig
const std = @import("std");

pub const StructA = struct {
    number1: i16,
    number2: i16,
};

pub const StructB = struct {
    a: ?StructA,
    number3: f64,
};

pub fn printStruct(s: StructB) void {
    std.debug.print("{any}\n", .{s});
}
