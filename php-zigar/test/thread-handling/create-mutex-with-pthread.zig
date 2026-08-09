const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const c = @import("c");
const pthread_t = c.pthread_t;
const pthread_mutex_t = c.pthread_mutex_t;
const zigar = @import("zigar");

const io = threaded_io.io();

var mutex: pthread_mutex_t = undefined;

pub fn spawn() !void {
    if (c.pthread_mutex_init(&mutex, null) != 0) return error.CannotCreateMutex;
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    std.debug.print("Thread 1 acquired mutex\n", .{});
    std.Io.sleep(io, .fromMilliseconds(50), .real) catch unreachable;
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.Io.sleep(io, .fromMilliseconds(10), .real) catch unreachable;
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
