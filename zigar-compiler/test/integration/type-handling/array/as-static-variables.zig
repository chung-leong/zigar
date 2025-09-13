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

pub var string: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };

pub var plain_array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };

pub var complex_array: [3]struct {
    int: i32,
    float: f64,
} = .{
    .{ .int = 1234, .float = 3.125 },
    .{ .int = 333, .float = 0.1 },
    .{ .int = 10000, .float = 123.456 },
};

const ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return T == ns and decl == .string;
    }

    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return T == ns and switch (decl) {
            .plain_array, .complex_array => true,
            else => false,
        };
    }
};
