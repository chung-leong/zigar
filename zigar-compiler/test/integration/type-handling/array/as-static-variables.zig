const std = @import("std");

pub var int32_array4: [4]i32 = .{ 1, 2, 3, 4 };
pub const float64_array4x4: [4][4]f64 = .{
    .{ 1.1, 1.2, 1.3, 1.4 },
    .{ 2.1, 2.2, 2.3, 2.4 },
    .{ 3.1, 3.2, 3.3, 3.4 },
    .{ 4.1, 4.2, 4.3, 4.4 },
};

pub fn print() void {
    std.debug.print("{d}", .{int32_array4});
}
