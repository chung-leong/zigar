const std = @import("std");
const zig = @import("./hello.zig");
const c = @cImport({
    @cInclude("./hello.c");
});

pub fn printZig() void {
    std.debug.print("{s}\n", .{zig.hello()});
}

pub fn printC() void {
    std.debug.print("{s}\n", .{c.hello()});
}
