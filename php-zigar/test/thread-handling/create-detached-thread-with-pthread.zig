const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_attr_t = c.pthread_attr_t;

pub fn spawn() !void {
    var attr: pthread_attr_t = undefined;
    if (c.pthread_attr_init(&attr) != 0) return error.CannotCreateThreadAttributes;
    if (c.pthread_attr_setdetachstate(&attr, c.PTHREAD_CREATE_DETACHED) != 0) return error.CannotSetThreadAttributes;
    defer if (c.pthread_attr_destroy(&attr) != 0) @panic("Unable to destroy attributes");
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, &attr, run, null) != 0) return error.CannotCreateThread;
    var retval: ?*anyopaque = undefined;
    if (c.pthread_join(thread_id, &retval) == 0) return error.AbleToJoinDetachedThread;
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Hello world!\n", .{});
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
