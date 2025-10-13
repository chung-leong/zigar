const std = @import("std");

pub const object: struct {
    typed_array: [4]f64 = .{ 1, 2, 3, 4 },
    string: []const u8 = "Hello world",
    object: struct {
        number1: i32 = 0,
        number2: i32 = 0,
    } = .{},
    number: i64 = 123,
    undefined: void = {},
} = .{};

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isFieldTypedArray(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isFieldPlain(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }
};
