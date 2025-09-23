const std = @import("std");
const builtin = @import("builtin");

fn printPosix() !void {
    const environ = std.c.environ;
    const count = std.mem.len(environ);
    for (0..count) |i| {
        if (environ[i]) |v| {
            std.debug.print("{s}\n", .{v});
        }
    }
}

pub const print = switch (builtin.target.os.tag) {
    .windows => {},
    else => printPosix,
};

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
