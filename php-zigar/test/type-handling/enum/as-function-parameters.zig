const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};

pub fn print(value1: Pet, value2: Pet) void {
    std.debug.print("{any} {any}\n", .{ value1, value2 });
}
