const std = @import("std");

const Struct = struct {
    string: []const u8 = "Hello world",
    plain: []const u8 = "Hello world",
    typed_array: []const u8 = "Hello world",
};

const Callback = fn ([]const u8, []const u8, []const u8, Struct) i32;

var callback: *const Callback = undefined;

pub fn setCallback(cb: *const Callback) void {
    callback = cb;
}

pub fn triggerCallback() i32 {
    return callback("Hello world", "Hello world", "Hello world", .{});
}

const module = @This();
pub const @"meta(zigar)" = struct {
    pub fn isArgumentString(comptime T: type, comptime arg_index: usize) bool {
        return switch (T) {
            Callback => arg_index == 0,
            else => false,
        };
    }

    pub fn isArgumentPlain(comptime T: type, comptime arg_index: usize) bool {
        return switch (T) {
            Callback => arg_index == 1 or arg_index == 3,
            else => false,
        };
    }

    pub fn isArgumentTypedArray(comptime T: type, comptime arg_index: usize) bool {
        return switch (T) {
            Callback => arg_index == 2,
            else => false,
        };
    }

    pub fn isFieldString(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        return T == Struct and field == .string;
    }

    pub fn isFieldPlain(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        return T == Struct and field == .plain;
    }

    pub fn isFieldTypedArray(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        return T == Struct and field == .typed_array;
    }
};
