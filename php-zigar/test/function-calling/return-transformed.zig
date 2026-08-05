const std = @import("std");

pub fn returnString() []const u8 {
    return "Hello world";
}

pub fn returnPlain() []const u8 {
    return "Hello world";
}

pub fn returnTypedArray() []const u8 {
    return "Hello world";
}

const Struct = struct {
    string: []const u8 = "Hello world",
    plain: []const u8 = "Hello world",
    typed_array: []const u8 = "Hello world",
};

pub fn returnStruct() Struct {
    return .{};
}

const module = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .returnString,
            else => false,
        };
    }

    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .returnPlain or decl == .returnStruct,
            else => false,
        };
    }

    pub fn isDeclTypedArray(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .returnTypedArray,
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
