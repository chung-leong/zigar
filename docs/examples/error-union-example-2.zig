const std = @import("std");

const MathError = error{negative_number};

pub fn getSquareRoots(allocator: std.mem.Allocator, numbers: []const f64) ![]MathError!f64 {
    const results = try allocator.alloc(MathError!f64, numbers.len);
    for (numbers, results) |number, *result_ptr| {
        result_ptr.* = if (number >= 0) @sqrt(number) else MathError.negative_number;
    }
    return results;
}
