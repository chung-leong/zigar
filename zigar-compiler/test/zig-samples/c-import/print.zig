const std = @import("std");

const c = @import("c");

const zig = @import("./hello.zig");

pub fn printZig() void {
    std.debug.print("{s}\n", .{zig.hello()});
}

pub fn printC() void {
    std.debug.print("{s}\n", .{c.hello()});
}
