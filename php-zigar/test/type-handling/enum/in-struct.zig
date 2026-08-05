const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};
pub const StructA = struct {
    pet1: Pet = Pet.monkey,
    pet2: Pet = Pet.dog,
};

pub var struct_a: StructA = .{ .pet1 = Pet.dog, .pet2 = Pet.cat };

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
