const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};
pub const StructA = struct {
    pet1: Pet = Pet.Monkey,
    pet2: Pet = Pet.Dog,
};

pub var struct_a: StructA = .{ .pet1 = Pet.Dog, .pet2 = Pet.Cat };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
