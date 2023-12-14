const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};

pub var vector: @Vector(3, Pet) = .{ Pet.Dog, Pet.Cat, Pet.Monkey };
pub const vector_const: @Vector(3, void) = .{ Pet.Cat, Pet.Dog, Pet.Monkey };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
