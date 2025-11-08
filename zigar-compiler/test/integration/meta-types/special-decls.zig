const std = @import("std");

pub const clamped_array: [4]u8 = .{ 1, 2, 3, 4 };
pub const typed_array: [4]f64 = .{ 1, 2, 3, 4 };
pub const string: []const u8 = "Hello world";
pub const object: struct {
    number1: i32 = 0,
    number2: i32 = 0,
} = .{};
pub const number: i64 = 123;
pub const @"void": void = {};

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime name: std.meta.DeclEnum(T)) bool {
        return name != .clamped_array;
    }

    pub fn isDeclClampedArray(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }

    pub fn isDeclTypedArray(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }

    pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
