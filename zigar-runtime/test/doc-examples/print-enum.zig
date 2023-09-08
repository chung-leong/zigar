// print-enum.zig
const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Snake,
    Chicken,
};

pub fn printTag(tag: Pet) void {
    std.debug.print("{s}: {d}\n", .{ @tagName(tag), @intFromEnum(tag) });
}
