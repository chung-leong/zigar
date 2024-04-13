const std = @import("std");

pub const Point = extern struct { x: f64, y: f64 };
pub const Points = []const Point;

pub fn printPoint(point: *const Point) void {
    std.debug.print("({d}, {d})\n", .{ point.x, point.y });
}

pub fn printPoints(points: Points) void {
    for (points) |*p| {
        printPoint(p);
    }
}
