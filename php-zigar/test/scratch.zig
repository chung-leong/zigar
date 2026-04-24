const std = @import("std");

pub const StructA = struct {
    array1: [4]i32 = .{ 1, 2, 3, 4 },
    array2: [4]i32 = .{ 5, 6, 7, 8 },
};

pub const StructB = struct {
    foo: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' },
    bar: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' },
};

pub const StructC = struct {
    pub const foo: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
    pub const bar: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };
};

pub var struct_a: StructA = .{
    .array1 = .{ 10, 20, 30, 40 },
    .array2 = .{ 11, 21, 31, 41 },
};

pub var struct_b: StructB = .{};

pub var plain_struct_a: StructA = .{
    .array1 = .{ 10, 20, 30, 40 },
    .array2 = .{ 11, 21, 31, 41 },
};

pub var plain_struct_b: StructB = .{};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}

const ns = @This();

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        if (T == StructC and decl == .foo) return true;
        return false;
    }

    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        if (T == ns and decl == .plain_struct_a) return true;
        if (T == ns and decl == .plain_struct_b) return true;
        return false;
    }

    pub fn isFieldString(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        if (T == StructB and field == .foo) return true;
        return false;
    }
};
