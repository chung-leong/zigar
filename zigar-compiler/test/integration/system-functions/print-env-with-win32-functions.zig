const std = @import("std");
const builtin = @import("builtin");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn print() !void {}

pub fn get(allocator: std.mem.Allocator, name: [*:0]const u8) ![]const u8 {
    const len = windows_h.GetEnvironmentVariableA(name, null, 0);
    if (len == 0) return error.NotFound;
    const buf = try allocator.alloc(u8, len);
    _ = windows_h.GetEnvironmentVariableA(name, buf.ptr, len);
    return buf[0 .. len - 1];
}

pub fn getW(allocator: std.mem.Allocator, name: [*:0]const u16) ![]const u16 {
    const len = windows_h.GetEnvironmentVariableW(name, null, 0);
    if (len == 0) return error.NotFound;
    const buf = try allocator.alloc(u16, len);
    _ = windows_h.GetEnvironmentVariableW(name, buf.ptr, len);
    return buf[0 .. len - 1];
}

const module_ns = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(T: type, field: std.meta.DeclEnum(T)) bool {
        return T == module_ns and switch (field) {
            .get, .getW => true,
            else => false,
        };
    }
};
