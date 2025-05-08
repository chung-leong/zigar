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

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime CT: type, comptime field_name: []const u8) bool {
        if (CT == StructB and std.mem.eql(u8, field_name, "foo")) return true;
        if (CT == StructC and std.mem.eql(u8, field_name, "foo")) return true;
        return false;
    }
};
