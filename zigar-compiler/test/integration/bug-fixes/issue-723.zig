const std = @import("std");

const Struct = struct {
    text: []const u8,
};
const Callback = fn (s: Struct) void;

var cb: ?*const Callback = null;

pub fn setCallback(f: ?*const Callback) void {
    cb = f;
}

pub fn runCallback(allocator: std.mem.Allocator, text: []const u8) !void {
    if (cb) |f| {
        f(.{ .text = try allocator.dupe(u8, text) });
    }
}
