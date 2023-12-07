const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Monkey,
};

pub const Donut = enum(u128) {
    Jelly = 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe,
    Plain = 0,
};

pub var pet: Pet = .Cat;

pub fn print() void {
    std.debug.print("{any}\n", .{pet});
}
