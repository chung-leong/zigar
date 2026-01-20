const std = @import("std");

// pub var boolean: bool = true;

// pub var x: i32 = 1234;
// pub var y: @Vector(4, i32) = .{ 1, 2, 3, 4 };
// pub var z: f32 = 3.12459;

// pub fn printX() void {
//     std.debug.print("x = {d}\n", .{x});
// }

// pub fn printY() void {
//     std.debug.print("y = {any}\n", .{y});
// }

// pub fn printZ() void {
//     std.debug.print("z = {d}\n", .{z});
// }

const Point = struct {
    x: usize,
    y: usize,
    comptime z: comptime_int = 1234,
};

pub var point: Point = .{ .x = 123, .y = 456 };

// pub var optional: ?u32 = 1234;

// pub var array: [4]i32 = .{ 1, 2, 3, 4 };

// pub fn printArray() void {
//     std.debug.print("y = {any}\n", .{array});
// }

// pub const ci = 1234;
// pub const cf = 3.14;

// pub const enum_literal = .hello;

// const Color = enum { red, blue, green };
// pub var color: Color = .red;

// pub const null_value = null;
// pub const undefined_value = undefined;
