const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;

pub fn spawn() !void {
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    for (0..10) |i| {
        std.debug.print("Hello world! {d}\n", .{i});
        if (i == 3) c.pthread_exit(@ptrFromInt(0x1234));
    }
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
