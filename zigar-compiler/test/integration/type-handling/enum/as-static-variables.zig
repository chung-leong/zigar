const std = @import("std");

pub const Pet = enum {
    dog,
    cat,
    monkey,
};

pub const Donut = enum(u128) {
    Jelly = 0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffe,
    Plain = 0,
    _,
};

pub var pet: Pet = .cat;
pub var donut: Donut = @enumFromInt(5);

pub fn print() void {
    std.debug.print("{any}\n", .{pet});
}
