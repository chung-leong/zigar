const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};

pub var vector: @Vector(3, Pet) = .{ Pet.dog, Pet.cat, Pet.monkey };
pub const vector_const: @Vector(3, void) = .{ Pet.cat, Pet.dog, Pet.monkey };

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
