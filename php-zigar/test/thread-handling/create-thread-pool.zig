const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var pool: std.Thread.Pool = undefined;

pub fn startup(n_jobs: u32) !void {
    try zigar.thread.use();
    try pool.init(.{
        .n_jobs = n_jobs,
        .allocator = gpa.allocator(),
    });
}

var count: usize = 0;

pub fn spawn(cb: *const fn () void) !void {
    const ns = struct {
        fn run(f: *const fn () void) void {
            f();
            count += 1;
        }
    };
    try pool.spawn(ns.run, .{cb});
}

pub fn getCount() usize {
    return count;
}

pub fn shutdown() void {
    pool.deinit();
    zigar.thread.end();
}
