const std = @import("std");

var value = std.atomic.Value(u32).init(0);

pub fn wait() void {
    std.Thread.Futex.wait(&value, 0);
}

pub fn increment() void {
    _ = value.fetchAdd(1, .monotonic);
}
