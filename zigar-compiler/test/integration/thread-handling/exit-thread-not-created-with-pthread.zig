const std = @import("std");

const zigar = @import("zigar");

const c = @cImport({
    @cInclude("pthread.h");
});
const pthread_t = c.pthread_t;
const pthread_key_t = c.pthread_key_t;

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var key: pthread_key_t = undefined;

pub fn spawn() !void {
    if (c.pthread_key_create(&key, destructor) != 0) return error.CannotCreateKey;
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{});
    thread.detach();
}

fn destructor(ptr: ?*anyopaque) callconv(.c) void {
    std.debug.print("Destructor called: {?}\n", .{ptr});
}

fn run() void {
    _ = c.pthread_setspecific(key, @ptrFromInt(0x12345));
    while (true) {
        c.pthread_exit(null);
    }
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
