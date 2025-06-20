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

pub fn decompress(
    reader: std.io.AnyReader,
    writer: std.io.AnyWriter,
    promise: zigar.function.PromiseOf(ns.decompress),
) !void {
    try work_queue.push(ns.decompress, .{ reader, writer }, promise);
}

const ns = struct {
    pub fn decompress(reader: std.io.AnyReader, writer: std.io.AnyWriter) !void {
        var buffer: std.io.BufferedReader(4096, std.io.AnyReader) = .{
            .unbuffered_reader = reader,
        };
        var dc = try std.compress.xz.decompress(gpa.allocator(), buffer.reader());
        defer dc.deinit();
        var fifo: std.fifo.LinearFifo(u8, .{ .Static = 128 }) = .init();
        try fifo.pump(dc.reader(), writer);
    }
};
