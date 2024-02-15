const std = @import("std");

pub const JunkFood = enum(u16) {
    hamburger,
    hotdog,
    donut,
    pizza,
    taco,
    _,
};

pub var junk: JunkFood = .donut;

pub fn print() void {
    std.debug.print("junk = {any}\n", .{junk});
}
