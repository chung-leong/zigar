const std = @import("std");

pub fn getBytes() []const u8 {
    return "World";
}

pub fn getText() []const u8 {
    return "Hello";
}

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return decl == .getText;
    }
};
