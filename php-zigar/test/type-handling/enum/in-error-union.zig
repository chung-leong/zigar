const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };
pub const Pet = enum {
    dog,
    cat,
    monkey,
};

pub var error_union: Error!Pet = Pet.cat;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
