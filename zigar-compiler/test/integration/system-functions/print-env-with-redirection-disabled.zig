const std = @import("std");
const builtin = @import("builtin");

pub fn get(allocator: std.mem.Allocator, name: [*:0]const u8) ![]const u8 {
    const value = std.c.getenv(name) orelse return error.NotFound;
    return allocator.dupe(u8, value[0..std.mem.len(value)]);
}

const module_ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(T: type, field: std.meta.DeclEnum(T)) bool {
        return (T == module_ns and field == .get);
    }
};
