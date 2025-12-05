const std = @import("std");
const builtin = @import("builtin");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_once_t = c.pthread_once_t;

var once: pthread_once_t = if (builtin.target.os.tag.isDarwin())
    .{ .__sig = 0x30B1BCBA }
else
    c.PTHREAD_ONCE_INIT;

pub fn spawn() !void {
    var thread_id: pthread_t = undefined;
    for (0..4) |_| {
        if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
        if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    }
}

fn init() callconv(.c) void {
    std.debug.print("Once upon a time...\n", .{});
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_once(&once, &init);
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
