const std = @import("std");
const builtin = @import("builtin");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_key_t = c.pthread_key_t;

var key1: pthread_key_t = undefined;
var key2: pthread_key_t = undefined;

pub fn spawn() !void {
    if (c.pthread_key_create(&key1, destructor1) != 0) return error.CannotCreateKey;
    if (c.pthread_key_create(&key2, destructor2) != 0) return error.CannotCreateKey;
    var thread_id: pthread_t = undefined;
    if (c.pthread_create(&thread_id, null, run1, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
    if (c.pthread_create(&thread_id, null, run2, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

var destructor_called: usize = 0;

pub fn getDestruction() usize {
    return destructor_called;
}

fn destructor1(ptr: ?*anyopaque) callconv(.c) void {
    destructor_called += 1;
    // can't output during clean-up in MacOS
    if (!builtin.target.os.tag.isDarwin()) {
        std.debug.print("Destructor 1 called: {?}\n", .{ptr});
    }
}

fn destructor2(ptr: ?*anyopaque) callconv(.c) void {
    destructor_called += 1;
    if (!builtin.target.os.tag.isDarwin()) {
        std.debug.print("Destructor 2 called: {?}\n", .{ptr});
    }
}

fn run1(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_setspecific(key1, @ptrFromInt(0x12345));
    _ = c.pthread_setspecific(key2, @ptrFromInt(0x67));
    std.Thread.sleep(30 * 1000000);
    const value1 = c.pthread_getspecific(key1);
    const value2 = c.pthread_getspecific(key2);
    std.debug.print("Thread 1 found {?} and {?}\n", .{ value1, value2 });
    c.pthread_exit(null);
    return null;
}

fn run2(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    _ = c.pthread_setspecific(key1, @ptrFromInt(0x22222));
    std.Thread.sleep(30 * 1000000);
    const value1 = c.pthread_getspecific(key1);
    const value2 = c.pthread_getspecific(key2);
    std.debug.print("Thread 2 found {?} and {?}\n", .{ value1, value2 });
    c.pthread_exit(null);
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
