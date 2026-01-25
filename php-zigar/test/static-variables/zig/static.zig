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

// const Point = struct {
//     x: usize,
//     y: usize,
//     comptime z: comptime_int = 1234,
// };

// pub var point: Point = .{ .x = 123, .y = 456 };

// pub var optional: ?u32 = 1234;

// pub var array: [4]i32 = .{ 1, 2, 3, 4 };

// pub fn printArray() void {
//     std.debug.print("y = {any}\n", .{array});
// }

// pub const ci = 1234;
// pub const cf = 3.14;

// pub const enum_literal = .hello;

// pub const Color = enum { red, blue, green };
// pub var color: Color = .red;

// pub const null_value = null;
// pub const undefined_value = undefined;

// const Number = union(enum) {
//     int: i64,
//     float: f64,
// };

// pub var number: Number = .{ .int = 1234 };

// pub const ErrorSet = error{ HelloWorld, PantsOnFire, OutOfMoney, ChickenDied };
// pub var error_value: ErrorSet = error.PantsOnFire;

// pub var problematic1: ErrorSet!i32 = error.PantsOnFire;
// pub var problematic2: ErrorSet!i32 = 1234;

// const Error = error{some_error};

// pub fn fail() void {
//     @call(.never_inline, a, .{}) catch {
//         const trace = @errorReturnTrace() orelse return;
//         std.debug.dumpStackTrace(trace.*);
//     };
// }

// fn a() !void {
//     try @call(.never_inline, b, .{});
// }

// fn b() !void {
//     try @call(.never_inline, c, .{});
// }

// fn c() !void {
//     try @call(.never_inline, d, .{});
// }

// fn d() !void {
//     return error.HomerSimpson;
// }

// const BareUnion = union {
//     integer: i64,
//     float: f64,
// };

// pub var bare_union: BareUnion = .{ .integer = 1234 };

// const TaggedUnion = union(enum) {
//     integer: i64,
//     float: f64,
// };

// pub var tagged_union: BareUnion = .{ .float = 1.234 };

// const ExternUnion = union {
//     integer: i64,
//     float: f64,
// };

// pub var extern_union: ExternUnion = .{ .integer = 1234 };

// pub const number: i64 = 1234;
