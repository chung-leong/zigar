const std = @import("std");

const IntegerOrTextT = union(enum) {
    number: i32,
    text: []const u8,
};

const IntegerOrTextB = union {
    number: i32,
    text: []const u8,
};

pub fn getT(allocator: std.mem.Allocator, text: bool) !IntegerOrTextT {
    return if (text)
        .{ .text = try allocator.dupe(u8, "Hello") }
    else
        .{ .number = 1234 };
}

pub fn getB(allocator: std.mem.Allocator, text: bool) !IntegerOrTextB {
    return if (text)
        .{ .text = try allocator.dupe(u8, "Hello") }
    else
        .{ .number = 1234 };
}
