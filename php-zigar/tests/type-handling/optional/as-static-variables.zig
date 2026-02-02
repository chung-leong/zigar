const std = @import("std");

pub var i32_empty: ?i32 = null;
pub var i32_value: ?i32 = 1234;

pub var bool_empty: ?bool = null;
pub var bool_value: ?bool = true;

pub const f64_empty: ?f64 = null;
pub const f64_value: ?f64 = 3.14;

pub const Struct = struct {
    integer: i32,
    boolean: bool,
    decimal: f32,
};

pub var struct_empty: ?Struct = null;
pub var struct_value: ?Struct = .{
    .integer = 1234,
    .boolean = true,
    .decimal = 3.5,
};

pub fn print() void {
    std.debug.print("{?d}\n", .{i32_value});
}

const ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return T == ns and switch (decl) {
            .struct_empty, .struct_value => true,
            else => false,
        };
    }
};
