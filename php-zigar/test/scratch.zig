const std = @import("std");

const Point = struct {
    x: f64,
    y: f64,
};

pub fn get(allocator: std.mem.Allocator, count: usize) ![]Point {
    const list = try allocator.alloc(Point, count);
    for (list, 0..) |*ptr, i| {
        ptr.* = .{
            .x = @floatFromInt(i + 1),
            .y = @floatFromInt(i + 1),
        };
    }
    return list;
}
