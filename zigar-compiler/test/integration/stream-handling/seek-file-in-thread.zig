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

pub const read = work_queue.promisify(ns.read);

const ns = struct {
    pub fn read(allocator: std.mem.Allocator, file: std.fs.File, offset: usize, len: usize) ![]u8 {
        try file.seekTo(offset);
        const buffer: []u8 = try allocator.alloc(u8, len);
        const bytes_read = try file.read(buffer);
        return buffer[0..bytes_read];
    }
};
