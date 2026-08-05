const std = @import("std");

var number: i32 = 1234;

pub const Opaque = opaque {};

pub const StructA = packed struct {
    opaque1: *Opaque,
    opaque2: *Opaque,
    number: u10,
    opaque3: *Opaque,
};

pub var struct_a: StructA = undefined;

pub fn init() void {
    struct_a = .{
        .opaque1 = @ptrCast(&number),
        .opaque2 = @ptrCast(&number),
        .number = 100,
        .opaque3 = @ptrCast(&number),
    };
}

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
