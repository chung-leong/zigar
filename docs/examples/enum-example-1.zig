const std = @import("std");

pub const Pet = enum { dog, cat, dragon };

pub fn print(pet: Pet) void {
    std.debug.print("pet = {s}\n", .{@tagName(pet)});
}