const std = @import("std");
var thread_io = std.Io.Threaded.init_single_threaded;

const io = thread_io.io();

var value = std.atomic.Value(u32).init(0);

pub fn wait() void {
    std.Io.futexWaitUncancelable(io, u32, &value.raw, 0);
}

pub fn increment() void {
    _ = value.fetchAdd(1, .monotonic);
}
