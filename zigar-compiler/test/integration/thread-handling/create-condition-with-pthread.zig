const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_mutex_t = c.pthread_mutex_t;
const pthread_cond_t = c.pthread_cond_t;
const pthread_condattr_t = c.pthread_condattr_t;

var mutex: pthread_mutex_t = undefined;
var cond: pthread_cond_t = undefined;

pub fn spawn() !void {
    if (c.pthread_mutex_init(&mutex, null) != 0) return error.CannotCreateMutex;
    var attrs: pthread_condattr_t = undefined;
    if (c.pthread_condattr_init(&attrs) != 0) return error.CannotCreateConditionAttributes;
    if (c.pthread_condattr_setclock(&attrs, c.CLOCK_REALTIME) != 0) return error.CannotSetConditionAttribute;
    if (c.pthread_cond_init(&cond, &attrs) != 0) return error.CannotCreateCondition;
    var thread_id: pthread_t = undefined;
    for (0..3) |_| {
        if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
        if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    }
}

pub fn signal() !void {
    if (c.pthread_cond_signal(&cond) != 0) return error.CannotSignalCondition;
}

pub fn broadcast() !void {
    if (c.pthread_cond_broadcast(&cond) != 0) return error.CannotBroadcastCondition;
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    std.debug.print("Thread waiting for condition\n", .{});
    if (c.pthread_cond_wait(&cond, &mutex) != 0) return null;
    std.debug.print("Thread saw condition\n", .{});
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
