const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};
pub const array: [3]Pet = .{ Pet.Monkey, Pet.Dog, Pet.Cat };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
