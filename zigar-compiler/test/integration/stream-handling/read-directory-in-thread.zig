const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

const zigar = @import("zigar");

const io = threaded_io.io();

var gpa = std.heap.DebugAllocator(.{}).init;

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
    pub fn print(dir: std.Io.Dir) !void {
        var iter = dir.iterate();
        while (try iter.next(io)) |entry| {
            std.debug.print("{s} {s}\n", .{ entry.name, @tagName(entry.kind) });
        }
    }
};
