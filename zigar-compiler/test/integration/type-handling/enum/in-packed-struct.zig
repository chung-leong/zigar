const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};
pub const StructA = packed struct {
    pet1: Pet = Pet.monkey,
    pet2: Pet = Pet.dog,
    number: u10 = 100,
    pet3: Pet = Pet.cat,
};

pub var struct_a: StructA = .{ .pet1 = Pet.dog, .pet2 = Pet.cat, .number = 200, .pet3 = Pet.monkey };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
