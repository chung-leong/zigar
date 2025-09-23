const std = @import("std");
const builtin = @import("builtin");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn print() !void {
    const p = windows_h.GetEnvironmentStringsA();
    if (p == null) return error.UnableToRetrieveEnvironmentStrings;
    var line: [*:0]const u8 = @ptrCast(p);
    while (true) {
        const len = std.mem.len(line);
        if (len == 0) break;
        std.debug.print("{s}\n", .{line[0..len]});
        line = line[len + 1 ..];
    }
    _ = windows_h.FreeEnvironmentStringsA(p);
}

pub fn printW() !void {
    const p = windows_h.GetEnvironmentStringsW();
    if (p == null) return error.UnableToRetrieveEnvironmentStrings;
    var line: [*:0]const u16 = @ptrCast(p);
    while (true) {
        const len = std.mem.len(line);
        if (len == 0) break;
        const line_a = try std.unicode.wtf16LeToWtf8Alloc(std.heap.c_allocator, line[0..len]);
        defer std.heap.c_allocator.free(line_a);
        std.debug.print("{s}\n", .{line_a});
        line = line[len + 1 ..];
    }
    _ = windows_h.FreeEnvironmentStringsW(p);
}

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
