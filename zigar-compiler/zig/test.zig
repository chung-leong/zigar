const std = @import("std");

pub fn main() void {
    const Enum = enum { Cow, Pig };
    std.debug.print("{any}\n", .{@field(Enum, "Cow")});
}
