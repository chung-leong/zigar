// hello-name.zig
const std = @import("std");

pub fn hello(name: []const u8) void {
    std.debug.print("Hello, {s}!", .{name});
}
