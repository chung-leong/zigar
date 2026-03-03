const std = @import("std");

var number: i32 = 1234;

pub const Opaque = opaque {};

pub const StructA = packed struct {
    opaque1: *Opaque = @ptrCast(&number),
    opaque2: *Opaque = @ptrCast(&number),
    number: u10 = 100,
    opaque3: *Opaque = @ptrCast(&number),
};

pub var struct_a: StructA = .{};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
