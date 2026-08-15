const std = @import("std");

const zigar = @import("zigar");

pub fn spawn() !void {}

pub fn signal() !void {}

pub fn broadcast() !void {}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
