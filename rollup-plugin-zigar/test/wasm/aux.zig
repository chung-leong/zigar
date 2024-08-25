const std = @import("std");

export fn hello() void {
    std.debug.print("hello\n", .{});
}

export fn world() void {
    std.debug.print("world\n", .{});
}
