const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;

pub fn spawn(count: usize) !void {
    var thread_id: pthread_t = undefined;
    var prev_thread_id: ?pthread_t = null;
    for (0..count) |_| {
        defer prev_thread_id = thread_id;
        if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
        if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
        if (prev_thread_id) |pid| {
            if (c.pthread_equal(thread_id, pid) != 0) return error.DuplicateThreadId;
        }
    }
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    const thread_id = c.pthread_self();
    std.debug.print("thread_id = {any}\n", .{thread_id});
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
