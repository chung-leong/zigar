const std = @import("std");

const StructA = struct {
    vector1: @Vector(4, f32),
    vector2: @Vector(4, f64),
};

pub fn allocate(allocator: std.mem.Allocator, count: u32) []StructA {
    const structs = allocator.alloc(StructA, count);
    const pi = std.math.pi;
    for (structs, 0..) |*struct_ptr, index| {
        struct_ptr.* = .{
            .vector1 = .{ 
                pi * 0.25 * (index + 1),
                pi * 0.50 * (index + 1),
                pi * 0.75 * (index + 1),
                pi * 1.00 * (index + 1),
            },
            .vector2 = .{
                pi * 0.25 / (index + 1),
                pi * 0.50 / (index + 1),
                pi * 0.75 / (index + 1),
                pi * 1.00 / (index + 1),
            },
        };
    }
    return structs;
}
