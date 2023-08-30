const std = @import("std");

const StructA = struct {
    vector1: @Vector(4, f32),
    vector2: @Vector(4, f64),
};

pub fn allocate(allocator: std.mem.Allocator, count: u32) ![]StructA {
    const structs = try allocator.alloc(StructA, count);
    const pi = std.math.pi;
    for (structs, 0..) |*struct_ptr, index| {
        struct_ptr.* = .{
            .vector1 = .{
                pi * 0.25 * @as(f32, @floatFromInt(index + 1)),
                pi * 0.50 * @as(f32, @floatFromInt(index + 1)),
                pi * 0.75 * @as(f32, @floatFromInt(index + 1)),
                pi * 1.00 * @as(f32, @floatFromInt(index + 1)),
            },
            .vector2 = .{
                pi * 0.25 / @as(f64, @floatFromInt(index + 1)),
                pi * 0.50 / @as(f64, @floatFromInt(index + 1)),
                pi * 0.75 / @as(f64, @floatFromInt(index + 1)),
                pi * 1.00 / @as(f64, @floatFromInt(index + 1)),
            },
        };
    }
    return structs;
}
