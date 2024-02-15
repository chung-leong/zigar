const std = @import("std");

pub fn showAlignments() void {
    const Ts = .{
        [4]f32,
        @Vector(4, f32),
        [2]f64,
        @Vector(2, f64),
        [4]f64,
        @Vector(4, f64),
        [8]f64,
        @Vector(8, f64),
    };
    inline for (Ts) |T| {
        std.debug.print("@alignOf({s}) = {d}\n", .{ @typeName(T), @alignOf(T) });
    }
}
