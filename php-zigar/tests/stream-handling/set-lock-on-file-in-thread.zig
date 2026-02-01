const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

pub fn spawn(file: std.fs.File, promise: zigar.function.Promise(usize)) !void {
    const thread = try std.Thread.spawn(.{
        .allocator = gpa.allocator(),
    }, run, .{ file, promise });
    thread.detach();
}

fn run(file: std.fs.File, promise: zigar.function.Promise(usize)) !void {
    try file.lock(.exclusive);
    defer file.unlock();
    const written = try file.write("Hello world");
    promise.resolve(written);
}

pub fn startup() !void {
    try zigar.thread.use();
}

pub fn shutdown() void {
    zigar.thread.end();
}
