const std = @import("std");

pub const Object = struct {
    a: i32,
    b: i32,
};

pub fn getPointer(allocator: std.mem.Allocator) ![*]Object {
    const slice = try allocator.alloc(Object, 5);
    for (slice, 0..) |*p, index| {
        p.* = .{
            .a = @intCast(index * 2),
            .b = @intCast(index * 2 + 1),
        };
    }
    return @ptrCast(slice);
}
