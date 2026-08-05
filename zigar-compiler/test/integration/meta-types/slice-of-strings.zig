const std = @import("std");

pub const names = [_][]const u8{
    "Agnieszka",
    "Basia",
    "Carmen",
};

pub fn getNames() []const []const u8 {
    return names[0..2];
}

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
