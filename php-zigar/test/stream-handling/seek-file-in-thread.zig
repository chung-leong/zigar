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

pub const read = work_queue.promisify(ns.read);

const ns = struct {
    pub fn read(allocator: std.mem.Allocator, file: std.Io.File, offset: i64, len: usize) ![]u8 {
        var buffer: [1024]u8 = undefined;
        var reader = file.reader(io, &buffer);
        try reader.seekBy(offset);
        const ri = &reader.interface;
        return try ri.readAlloc(allocator, len);
    }
};
