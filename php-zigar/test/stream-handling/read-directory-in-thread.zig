const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

var work_queue: zigar.thread.WorkQueue(ns) = .{};

pub fn startup(thread_count: usize) !void {
    try work_queue.init(.{
        .allocator = gpa.allocator(),
        .stack_size = 65536,
        .n_jobs = thread_count,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub const print = work_queue.promisify(ns.print);

const ns = struct {
    pub fn print(dir: std.fs.Dir) !void {
        var iter = dir.iterate();
        while (try iter.next()) |entry| {
            std.debug.print("{s} {s}\n", .{ entry.name, @tagName(entry.kind) });
        }
    }
};
