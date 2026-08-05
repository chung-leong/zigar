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

pub const decompress = work_queue.promisify(ns.decompress);

const ns = struct {
    pub fn decompress(in_file: std.fs.File, out_file: std.fs.File) !usize {
        var read_buffer: [4096]u8 = undefined;
        var reader = in_file.reader(&read_buffer);
        var deflate: std.compress.flate.Decompress = .init(&reader.interface, .gzip, &.{});
        var write_buffer: [4096]u8 = undefined;
        var writer = out_file.writer(&write_buffer);
        const interface = &writer.interface;
        defer interface.flush() catch {};
        return try deflate.reader.stream(interface, .unlimited);
    }
};
