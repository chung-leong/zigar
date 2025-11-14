const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_mutex_t = c.pthread_mutex_t;
const pthread_mutex_attr_t = c.pthread_mutexattr_t;

var mutex: pthread_mutex_t = undefined;

pub fn spawn() !void {
    var mutex_attr: pthread_mutex_attr_t = undefined;
    if (c.pthread_mutexattr_init(&mutex_attr) != 0) return error.CannotInitializeMutexAttributes;
    defer _ = c.pthread_mutexattr_destroy(&mutex_attr);
    if (c.pthread_mutexattr_settype(&mutex_attr, c.PTHREAD_MUTEX_ERRORCHECK) != 0) return error.CannotSetMutexType;
    var thread_id: pthread_t = undefined;
    if (c.pthread_mutex_init(&mutex, &mutex_attr) != 0) return error.CannotCreateMutex;
    if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    const retval = c.pthread_mutex_lock(&mutex);
    std.debug.print("retval == EDEADLK: {}\n", .{retval == @intFromEnum(std.c.E.DEADLK)});
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
