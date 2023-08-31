const std = @import("std");

pub const Pet = enum { Dog, Cat, Turtle };

pub fn printOne(pet: Pet) void {
    std.debug.print("{s}\n", .{@tagName(pet)});
}

pub fn printMultiple(pets: []Pet) void {
    for (pets) |pet| {
        std.debug.print("{s}\n", .{@tagName(pet)});            
    }
}
