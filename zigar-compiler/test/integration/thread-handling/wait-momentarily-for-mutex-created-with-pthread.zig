const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;
const builtin = @import("builtin");

const c = @import("c");
const pthread_t = c.pthread_t;
const pthread_mutex_t = c.pthread_mutex_t;
const pthread_mutex_attr_t = c.pthread_mutex_attr_t;
const zigar = @import("zigar");

const io = threaded_io.io();

var mutex: pthread_mutex_t = undefined;

pub fn spawn() !void {
    var thread_id: pthread_t = undefined;
    if (c.pthread_mutex_init(&mutex, null) != 0) return error.CannotCreateMutex;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run3, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

const clock_id = switch (builtin.target.os.tag) {
    .windows => .REALTIME_COARSE,
    else => .REALTIME,
};

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_mutex_lock(&mutex);
    defer _ = c.pthread_mutex_unlock(&mutex);
    std.debug.print("Thread 1 acquired mutex\n", .{});
    std.Io.sleep(io, .fromMilliseconds(70), .real) catch unreachable;
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.Io.sleep(io, .fromMilliseconds(10), .real) catch unreachable;
    var time: std.c.timespec = undefined;
    _ = std.c.clock_gettime(clock_id, &time);
    add(&time, 150 * 1000000);
    const retval = c.pthread_mutex_timedlock(&mutex, @ptrCast(&time));
    if (retval == 0) {
        defer _ = c.pthread_mutex_unlock(&mutex);
        std.debug.print("Thread 2 acquired mutex\n", .{});
    } else {
        std.debug.print("Thread 2 timed out: {}\n", .{retval == @intFromEnum(std.c.E.TIMEDOUT)});
    }
    return null;
}

fn run3(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.Io.sleep(io, .fromMilliseconds(10), .real) catch unreachable;
    var time: std.c.timespec = undefined;
    _ = std.c.clock_gettime(clock_id, &time);
    add(&time, 20 * 1000000);
    const retval = c.pthread_mutex_timedlock(&mutex, @ptrCast(&time));
    if (retval == 0) {
        defer _ = c.pthread_mutex_unlock(&mutex);
        std.debug.print("Thread 3 acquired mutex\n", .{});
    } else {
        std.debug.print("Thread 3 timed out: {}\n", .{retval == @intFromEnum(std.c.E.TIMEDOUT)});
    }
    return null;
}

fn add(time: *std.c.timespec, ns: c_long) void {
    time.nsec += ns;
    if (time.nsec > 1000000000) {
        time.sec += 1;
        time.nsec -= 1000000_000;
    }
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
