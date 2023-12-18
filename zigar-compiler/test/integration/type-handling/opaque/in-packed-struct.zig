const std = @import("std");

pub const StructA = packed struct {
    opaque1: void = opaque {},
    opaque2: void = opaque {},
    number: u10 = 100,
    opaque3: void = opaque {},
};

pub var struct_a: StructA = .{
    .opaque1 = opaque {},
    .opaque2 = opaque {},
    .number = 200,
    .opaque3 = opaque {},
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
