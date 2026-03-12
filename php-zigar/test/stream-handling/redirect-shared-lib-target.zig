const std = @import("std");

export fn print() void {
    std.debug.print("Hello world\n", .{});
}
