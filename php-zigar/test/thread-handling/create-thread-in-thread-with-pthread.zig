const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;

pub fn spawn() !void {
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return null;
    var retval: ?*anyopaque = undefined;
    if (c.pthread_join(thread_id, &retval) != 0) return null;
    if (c.pthread_detach(thread_id) == 0) return null;
    const address = if (retval) |ptr| @intFromPtr(ptr) else 0;
    std.debug.print("retval = {x}\n", .{address});
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    std.debug.print("Hello world!\n", .{});
    return @ptrFromInt(0x1234);
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
