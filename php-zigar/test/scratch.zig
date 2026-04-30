const std = @import("std");

const Struct = struct {
    self: *@This(),
    number: i32 = 1234,
};

pub fn create(allocator: std.mem.Allocator) !*Struct {
    const ptr = try allocator.create(Struct);
    ptr.* = .{ .self = ptr };
    return ptr;
}
