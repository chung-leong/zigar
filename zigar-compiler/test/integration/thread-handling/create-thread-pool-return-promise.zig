const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var pool: std.Thread.Pool = undefined;

pub fn start(n_jobs: u32) !void {
    try zigar.thread.use();
    try pool.init(.{
        .n_jobs = n_jobs,
        .allocator = gpa.allocator(),
    });
}

pub fn spawn(promise: zigar.function.Promise(i32)) !void {
    const ns = struct {
        fn run(p: zigar.function.Promise(i32)) void {
            p.resolve(1234);
        }
    };
    _ = try pool.spawn(ns.run, .{promise});
}

pub fn shutdown() !void {
    pool.deinit();
    try zigar.thread.end();
}
