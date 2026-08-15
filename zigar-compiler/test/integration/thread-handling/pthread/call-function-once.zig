const std = @import("std");
const builtin = @import("builtin");

const zigar = @import("zigar");

extern fn spawn_run_function_once(*const anyopaque) bool;
extern fn spawn_create_condition() bool;

pub fn spawn() !void {
    if (!spawn_run_function_once(&init)) return error.UnableToCreateThread;
}

pub fn spawn2() !void {
    if (!spawn_create_condition()) return error.UnableToCreateThread;
}

fn init() callconv(.c) void {
    std.debug.print("Once upon a time...\n", .{});
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
