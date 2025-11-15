const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
    @cInclude("semaphore.h");
    @cInclude("fcntl.h");
});
const pthread_t = c.pthread_t;
const sem_t = c.sem_t;

pub fn spawn() !void {
    const mode: c_int = 0o666;
    const value: c_int = 2;
    var semaphore: [*c]sem_t = undefined;
    semaphore = c.sem_open("dingo", 0);
    if (semaphore != c.SEM_FAILED) return error.IncorrectResponse;
    semaphore = c.sem_open("hello", c.O_CREAT | c.O_EXCL, mode, value);
    if (semaphore == c.SEM_FAILED) return error.CannotCreateNamedSemaphore;
    semaphore = c.sem_open("hello", c.O_CREAT | c.O_EXCL, mode, value);
    if (semaphore != c.SEM_FAILED) return error.IncorrectResponse;
    semaphore = c.sem_open("dingo", 0);
    if (semaphore != c.SEM_FAILED) return error.IncorrectResponse;
    semaphore = c.sem_open("hello", 0);
    if (semaphore == c.SEM_FAILED) return error.CannotFindNamedSemaphore;
    defer _ = c.sem_close(semaphore);
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run3, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

pub fn cleanup() !void {
    if (c.sem_unlink("hello") != 0) return error.CannotUnlinkSemaphore;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    const semaphore = c.sem_open("hello", 0);
    if (semaphore == c.SEM_FAILED) return null;
    std.debug.print("Thread 1 acquiring semaphore\n", .{});
    if (c.sem_wait(semaphore) != 0) return null;
    defer {
        std.debug.print("Thread 1 releasing semaphore\n", .{});
        _ = c.sem_post(semaphore);
    }
    var value: c_int = undefined;
    if (c.sem_getvalue(semaphore, &value) != 0) return null;
    std.debug.print("Thread 1 acquired semaphore: {d}\n", .{value});
    std.Thread.sleep(100 * 1000000);
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    const semaphore = c.sem_open("hello", 0);
    if (semaphore == c.SEM_FAILED) return null;
    std.debug.print("Thread 2 acquiring semaphore\n", .{});
    if (c.sem_wait(semaphore) != 0) return null;
    defer {
        std.debug.print("Thread 2 releasing semaphore\n", .{});
        _ = c.sem_post(semaphore);
    }
    var value: c_int = undefined;
    if (c.sem_getvalue(semaphore, &value) != 0) return null;
    std.debug.print("Thread 2 acquired semaphore: {d}\n", .{value});
    std.Thread.sleep(100 * 1000000);
    return null;
}

fn run3(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    const semaphore = c.sem_open("hello", 0);
    if (semaphore == c.SEM_FAILED) return null;
    std.debug.print("Thread 3 acquiring semaphore\n", .{});
    if (c.sem_wait(semaphore) != 0) return null;
    defer {
        std.debug.print("Thread 3 releasing semaphore\n", .{});
        _ = c.sem_post(semaphore);
    }
    var value: c_int = undefined;
    if (c.sem_getvalue(semaphore, &value) != 0) return null;
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
