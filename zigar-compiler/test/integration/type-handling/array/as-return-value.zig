const std = @import("std");

pub fn getArray() [4]i32 {
    return .{ 1, 2, 3, 4 };
}

pub fn getString() [5]u8 {
    return .{ 'H', 'e', 'l', 'l', 'o' };
}

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
