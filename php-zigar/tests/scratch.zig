const std = @import("std");

pub var string: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };

pub var plain_array: [5]u8 = .{ 'H', 'e', 'l', 'l', 'o' };

const ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return T == ns and decl == .string;
    }
};
