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

var destructor_called: usize = 0;

fn destructor(_: ?*anyopaque) callconv(.c) void {
    destructor_called += 1;
}

pub fn getDestruction() usize {
    return destructor_called;
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
