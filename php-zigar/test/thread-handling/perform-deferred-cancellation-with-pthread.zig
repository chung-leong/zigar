const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_key_t = c.pthread_key_t;

var key: pthread_key_t = undefined;
var thread_id: pthread_t = undefined;

pub fn spawn() !void {
    if (c.pthread_key_create(&key, destructor) != 0) return error.CannotCreateKey;
    if (c.pthread_create(&thread_id, null, run, null) != 0) return error.CannotCreateThread;
    if (c.pthread_detach(thread_id) != 0) return error.CannotDetachThread;
}

pub fn cancel() !void {
    if (c.pthread_cancel(thread_id) != 0) return error.CannotCancelThread;
}

fn destructor(ptr: ?*anyopaque) callconv(.c) void {
    const string: [*:0]const u8 = @ptrCast(ptr.?);
    std.debug.print("Destructor called: {s}\n", .{string});
}

fn cleanup(ptr: ?*anyopaque) callconv(.c) void {
    const number_ptr: *usize = @ptrCast(@alignCast(ptr));
    std.debug.print("Clean-up function called: {x}\n", .{number_ptr.*});
}

fn run(_: ?*anyopaque) callconv(.c) ?*anyopaque {
    const string: [*:0]const u8 = "Hello world";
    _ = c.pthread_setspecific(key, string);
    var number: usize = 0x12345;
    var ptcb: c.struct___ptcb = undefined;
    c._pthread_cleanup_push(&ptcb, cleanup, &number);
    defer c._pthread_cleanup_pop(&ptcb, 1);
    while (true) {
        c.pthread_testcancel();
    }
    return null;
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
