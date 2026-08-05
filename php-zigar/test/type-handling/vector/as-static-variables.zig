const std = @import("std");

pub const v1: @Vector(4, f64) = .{ 1, 2, 3, 4 };
pub var v2: @Vector(3, f32) = undefined;

pub fn print() void {
    std.debug.print("{d}\n", .{v2});
}

pub const v3: @Vector(4, f64) = .{ 1, 2, 3, 4 };

const ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return T == ns and switch (decl) {
            .v3 => true,
            else => false,
        };
    }
};
