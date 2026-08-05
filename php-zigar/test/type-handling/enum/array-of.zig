const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};
pub const array: [3]Pet = .{ Pet.monkey, Pet.dog, Pet.cat };

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
