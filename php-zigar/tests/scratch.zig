const std = @import("std");

pub const Enum = enum {
    hello,
    world,

    pub fn print(self: @This()) void {
        std.debug.print("{}\n", .{self});
    }
};

pub var value: Enum = .hello;

pub fn print() !void {
    return error.PantsOnFire;
    // std.debug.print("test\n", .{});
}
