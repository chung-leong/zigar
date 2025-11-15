const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
    @cInclude("semaphore.h");
});
const pthread_t = c.pthread_t;
const sem_t = c.sem_t;

var semaphore: sem_t = undefined;

pub fn spawn() !void {
    if (c.sem_init(&semaphore, 0, 2) != 0) return error.CannotCreateSemaphore;
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run3, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 1 acquiring semaphore\n", .{});
    var time: c.struct_timespec = undefined;
    _ = c.clock_gettime(c.CLOCK_REALTIME, &time);
    time.tv_nsec += 1000000;
    if (c.sem_timedwait(&semaphore, &time) != 0) {
        std.debug.print("Thread 1 timed out: {}\n", .{std.c._errno().* == @intFromEnum(std.c.E.TIMEDOUT)});
        return null;
    }
    defer {
        std.debug.print("Thread 1 releasing semaphore\n", .{});
        _ = c.sem_post(&semaphore);
    }
    var value: c_int = undefined;
    if (c.sem_getvalue(&semaphore, &value) != 0) return null;
    std.debug.print("Thread 1 acquired semaphore: {d}\n", .{value});
    std.Thread.sleep(100 * 1000000);
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 2 acquiring semaphore\n", .{});
    var time: c.struct_timespec = undefined;
    _ = c.clock_gettime(c.CLOCK_REALTIME, &time);
    time.tv_nsec += 1000000;
    if (c.sem_timedwait(&semaphore, &time) != 0) {
        std.debug.print("Thread 2 timed out: {}\n", .{std.c._errno().* == @intFromEnum(std.c.E.TIMEDOUT)});
        return null;
    }
    defer {
        std.debug.print("Thread 2 releasing semaphore\n", .{});
        _ = c.sem_post(&semaphore);
    }
    var value: c_int = undefined;
    if (c.sem_getvalue(&semaphore, &value) != 0) return null;
    std.debug.print("Thread 2 acquired semaphore: {d}\n", .{value});
    std.Thread.sleep(100 * 1000000);
    return null;
}

fn run3(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 3 acquiring semaphore\n", .{});
    var time: c.struct_timespec = undefined;
    _ = c.clock_gettime(c.CLOCK_REALTIME, &time);
    time.tv_nsec += 1000000;
    if (c.sem_timedwait(&semaphore, &time) != 0) {
        std.debug.print("Thread 3 timed out: {}\n", .{std.c._errno().* == @intFromEnum(std.c.E.TIMEDOUT)});
        return null;
    }
    defer {
        std.debug.print("Thread 3 releasing semaphore\n", .{});
        _ = c.sem_post(&semaphore);
    }
    var value: c_int = undefined;
    if (c.sem_getvalue(&semaphore, &value) != 0) return null;
    std.debug.print("Thread 3 acquired semaphore: {d}\n", .{value});
    std.Thread.sleep(100 * 1000000);
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
