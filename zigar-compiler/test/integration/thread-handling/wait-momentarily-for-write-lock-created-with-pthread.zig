const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
    @cInclude("time.h");
});
const pthread_t = c.pthread_t;
const pthread_rwlock_t = c.pthread_rwlock_t;

var rwlock: pthread_rwlock_t = undefined;

pub fn spawn() !void {
    if (c.pthread_rwlock_init(&rwlock, null) != 0) return error.CannotCreateReadWriteLock;
    if (c.pthread_rwlock_wrlock(&rwlock) != 0) return error.CannotObtainWriteLock;
    std.debug.print("Main thread acquired write lock\n", .{});
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

pub fn unlock() !void {
    std.debug.print("Main thread releasing write lock\n", .{});
    if (c.pthread_rwlock_unlock(&rwlock) != 0) return error.CannotReleaseReadWriteLock;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 1 acquiring write lock\n", .{});
    var time: c.struct_timespec = undefined;
    _ = c.clock_gettime(c.CLOCK_REALTIME, &time);
    add(&time, 1000);
    const retval = c.pthread_rwlock_timedwrlock(&rwlock, &time);
    if (retval == 0) {
        defer _ = c.pthread_rwlock_unlock(&rwlock);
        std.debug.print("Thread 1 acquired write lock\n", .{});
    } else {
        std.debug.print("Thread 1 timed out: {}\n", .{retval == @intFromEnum(std.c.E.TIMEDOUT)});
    }
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Thread 2 acquiring write lock\n", .{});
    var time: c.struct_timespec = undefined;
    _ = c.clock_gettime(c.CLOCK_REALTIME, &time);
    add(&time, 750 * 1000000);
    const retval = c.pthread_rwlock_timedrdlock(&rwlock, &time);
    if (retval == 0) {
        defer _ = c.pthread_rwlock_unlock(&rwlock);
        std.debug.print("Thread 2 acquired write lock\n", .{});
    } else {
        std.debug.print("Thread 2 timed out: {}\n", .{retval == @intFromEnum(std.c.E.TIMEDOUT)});
    }
    return null;
}

fn add(time: *c.struct_timespec, ns: c_long) void {
    time.tv_nsec += ns;
    if (time.tv_nsec > 1000000000) {
        time.tv_sec += 1;
        time.tv_nsec -= 1000000_000;
    }
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
