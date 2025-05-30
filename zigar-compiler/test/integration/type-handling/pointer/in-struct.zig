const std = @import("std");

pub const StructA = struct {
    text1: []const u8 = "apple",
    text2: []const u8 = "orange",
};

pub const StructB = struct {
    text1: []const u8 = "apple",
    text2: []const u8 = "orange",
};

pub const StructC = struct {
    pub const text1: []const u8 = "apple";
    pub const text2: []const u8 = "orange";

    pub fn hello() void {}
};

pub var struct_a: StructA = .{ .text1 = "dog", .text2 = "cat" };

pub const struct_b: StructB = .{};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: []const u8) bool {
        return switch (T) {
            StructB, StructC => true,
            else => false,
        };
    }
};
