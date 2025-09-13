const std = @import("std");

pub var optional: ?[]const u8 = "Hello";
pub var alt_text: []const u8 = "World";

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}

const Self = @This();

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, field: std.meta.DeclEnum(T)) bool {
        return T == Self and field == .optional;
    }
};
