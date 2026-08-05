const std = @import("std");

pub fn returnObject() struct {
    number1: i32 = 123,
    number2: i64 = 1234,
} {
    return .{};
}

pub fn returnString() []const u8 {
    return "Hello world";
}

pub fn returnTypedArray() []const u8 {
    return "Hello world";
}

pub fn returnClampedArray() []const u8 {
    return "Hello world";
}

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime name: std.meta.DeclEnum(T)) bool {
        return name == .returnString;
    }

    pub fn isDeclClampedArray(comptime T: type, comptime name: std.meta.DeclEnum(T)) bool {
        return name == .returnClampedArray;
    }

    pub fn isDeclTypedArray(comptime T: type, comptime name: std.meta.DeclEnum(T)) bool {
        return name == .returnTypedArray;
    }

    pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
