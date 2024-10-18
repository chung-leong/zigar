const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var pool: std.Thread.Pool = undefined;

pub fn start(n_jobs: u32) !void {
    try zigar.thread.use(true);
    try pool.init(.{
        .n_jobs = n_jobs,
        .allocator = gpa.allocator(),
    });
}

pub fn spawn(cb: *const fn () void) !void {
    const ns = struct {
        fn run(f: *const fn () void) void {
            f();
        }
    };
    _ = try pool.spawn(ns.run, .{cb});
}

pub fn shutdown() !void {
    pool.deinit();
    try zigar.thread.use(false);
}