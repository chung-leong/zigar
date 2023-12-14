const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };
pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};

pub var error_union: Error!Pet = Pet.Cat;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
