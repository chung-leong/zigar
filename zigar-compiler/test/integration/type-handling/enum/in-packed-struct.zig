const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};
pub const StructA = packed struct {
    pet1: Pet = Pet.Monkey,
    pet2: Pet = Pet.Dog,
    number: u10 = 100,
    pet3: Pet = Pet.Cat,
};

pub var struct_a: StructA = .{ .pet1 = Pet.Dog, .pet2 = Pet.Cat, .number = 200, .pet3 = Pet.Monkey };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
