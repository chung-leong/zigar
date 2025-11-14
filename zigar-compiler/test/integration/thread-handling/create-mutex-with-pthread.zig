const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_mutex_t = c.pthread_mutex_t;

var mutex: pthread_mutex_t = undefined;

pub fn spawn() !void {
    var thread_id: pthread_t = undefined;
    if (c.pthread_mutex_init(&mutex, null) != 0) return error.CannotCreateMutex;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    std.debug.print("Thread 1 acquired mutex\n", .{});
    std.Thread.sleep(50 * 1000000);
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.Thread.sleep(10 * 1000000);
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    std.debug.print("Thread 2 acquired mutex\n", .{});
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
