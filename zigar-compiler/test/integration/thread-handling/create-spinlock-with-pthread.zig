const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_spinlock_t = c.pthread_spinlock_t;

var spinlock: pthread_spinlock_t = undefined;

pub fn spawn() !void {
    var thread_id: pthread_t = undefined;
    if (c.pthread_spin_init(&spinlock, c.PTHREAD_PROCESS_PRIVATE) != 0) return error.CannotCreateSpinlock;
    if (c.pthread_spin_lock(&spinlock) != 0) return error.CannotObtainSpinlock;
    std.debug.print("Main thread acquired spinlock\n", .{});
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

pub fn unlock() !void {
    if (c.pthread_spin_unlock(&spinlock) != 0) return error.CannotObtainSpinlock;
    std.debug.print("Main thread released spinlock\n", .{});
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    if (c.pthread_spin_lock(&spinlock) == 0) {
        defer _ = c.pthread_spin_unlock(&spinlock);
        std.debug.print("Thread 1 acquired spinlock\n", .{});
    }
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    const retval = c.pthread_spin_trylock(&spinlock);
    if (retval == 0) {
        defer _ = c.pthread_spin_unlock(&spinlock);
        std.debug.print("Thread 2 acquired spinlock\n", .{});
    } else {
        std.debug.print("Thread 2 found busy lock: {}\n", .{retval == @intFromEnum(std.c.E.BUSY)});
    }
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
