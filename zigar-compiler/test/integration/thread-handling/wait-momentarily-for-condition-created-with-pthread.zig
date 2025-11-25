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
    for (0..3) |i| {
        var duration: usize = 3500000;
        for (0..i) |_| duration *= 10;
        const arg: *anyopaque = @ptrFromInt(duration);
        if (c.pthread_create(&thread_id, null, run, arg) != 0) return error.CannotCreateThread;
        if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    }
}

pub fn signal() !void {
    if (c.pthread_cond_signal(&cond) != 0) return error.CannotSignalCondition;
}

pub fn broadcast() !void {
    if (c.pthread_cond_broadcast(&cond) != 0) return error.CannotBroadcastCondition;
}

fn run(arg: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    std.debug.print("Thread waiting for condition\n", .{});
    var time: c.struct_timespec = undefined;
    _ = c.clock_gettime(c.CLOCK_REALTIME, &time);
    const duration: usize = @intFromPtr(arg);
    add(&time, @intCast(duration));
    const retval = c.pthread_cond_timedwait(&cond, &mutex, &time);
    if (retval == 0) {
        std.debug.print("Thread saw condition\n", .{});
    } else {
        std.debug.print("Thread timed out: {}\n", .{retval == @intFromEnum(std.c.E.TIMEDOUT)});
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
