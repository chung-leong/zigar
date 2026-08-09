const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const zigar = @import("zigar");

const io = threaded_io.io();

var gpa = std.heap.DebugAllocator(.{}).init;

pub fn spawn(file: std.Io.File, promise: zigar.function.Promise(usize)) !void {
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{ file, promise });
    thread.detach();
}

fn run(file: std.Io.File, promise: zigar.function.Promise(usize)) !void {
    try file.lock(io, .exclusive);
    defer file.unlock(io);
    const slices: [1][]const u8 = .{"Hello world"};
    const written = try file.writeStreaming(io, &.{}, slices[0..], 1);
    promise.resolve(written);
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
