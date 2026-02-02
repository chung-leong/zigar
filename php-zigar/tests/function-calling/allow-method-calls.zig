const std = @import("std");

pub const Struct = struct {
    number: i32,

    pub fn print1(self: @This()) void {
        std.debug.print("{any}\n", .{self});
    }

    pub fn print2(self: *@This()) void {
        std.debug.print("{any}\n", .{self.*});
    }

    pub fn add(self: *@This(), value: i32) void {
        self.number += value;
    }
};
