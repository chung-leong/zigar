const std = @import("std");

const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

var work_queue: zigar.thread.WorkQueue(thread_ns) = .{};

pub fn startup() !void {
    try work_queue.init(.{
        .allocator = gpa.allocator(),
        .stack_size = 65536,
        .n_jobs = 1,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub const call = work_queue.promisify(thread_ns.call);

const thread_ns = struct {
    pub fn call(num: i32) i32 {
        return num;
    }
};
