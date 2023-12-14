const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};
pub const StructA = struct {
    number: i32,
    comptime pet: Pet = Pet.Cat,
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
