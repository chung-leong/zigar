const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_rwlock_t = c.pthread_rwlock_t;

var rwlock: pthread_rwlock_t = undefined;
var write_lock = false;

pub fn spawn(write: bool) !void {
    if (c.pthread_rwlock_init(&rwlock, null) != 0) return error.CannotCreateReadWriteLock;
    write_lock = write;
    if (write_lock) {
        if (c.pthread_rwlock_wrlock(&rwlock) != 0) return error.CannotObtainWriteLock;
        std.debug.print("Main thread acquired write lock\n", .{});
    } else {
        if (c.pthread_rwlock_rdlock(&rwlock) != 0) return error.CannotObtainReadLock;
        std.debug.print("Main thread acquired read lock\n", .{});
    }
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

pub fn unlock() !void {
    if (c.pthread_rwlock_unlock(&rwlock) != 0) return error.CannotReleaseReadWriteLock;
    if (write_lock) {
        std.debug.print("Main thread released write lock\n", .{});
    } else {
        std.debug.print("Main thread released read lock\n", .{});
    }
}

pub fn cleanup() !void {
    if (c.pthread_rwlock_destroy(&rwlock) != 0) return error.CannotDestroyReadWriteLock;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 1 acquiring read lock\n", .{});
    if (c.pthread_rwlock_rdlock(&rwlock) == 0) {
        defer _ = c.pthread_rwlock_unlock(&rwlock);
        // without the sleep deadlock would occur due to the main thread waiting for
        // a mutex to write while the thread waits for its write to be processed
        std.Thread.sleep(2000000);
        std.debug.print("Thread 1 acquired read lock\n", .{});
    }
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 2 acquiring write lock\n", .{});
    if (c.pthread_rwlock_wrlock(&rwlock) == 0) {
        defer _ = c.pthread_rwlock_unlock(&rwlock);
        std.Thread.sleep(2000000);
        std.debug.print("Thread 2 acquired write lock\n", .{});
    }
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
