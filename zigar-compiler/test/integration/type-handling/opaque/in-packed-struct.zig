const std = @import("std");

var number: i32 = 1234;

pub const StructA = packed struct {
    opaque1: *anyopaque = @ptrCast(&number),
    opaque2: *anyopaque = @ptrCast(&number),
    number: u10 = 100,
    opaque3: *anyopaque = @ptrCast(&number),
};

pub var struct_a: StructA = .{};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
