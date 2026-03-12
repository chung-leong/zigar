const std = @import("std");

pub const Opaque = opaque {};

var number: i32 = 1234;

pub const StructA = struct {
    number: i32,
    comptime ptr: *Opaque = @ptrCast(&number),
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
