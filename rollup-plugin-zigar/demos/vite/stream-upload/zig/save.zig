const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(thread_ns) = .{};

pub fn startup() !void {
    try work_queue.init(.{ .allocator = std.heap.wasm_allocator });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub fn save(
    writer: std.io.AnyWriter,
    promise: zigar.function.PromiseOf(thread_ns.save),
) !void {
    try work_queue.push(thread_ns.save, .{writer}, promise);
}

const thread_ns = struct {
    pub fn save(writer: std.io.AnyWriter) !void {
        var buffer = std.io.bufferedWriter(writer);
        var buffered_writer = buffer.writer();
        for (0..100000) |i| {
            try buffered_writer.print("Hello world {d}\n", .{i});
        }
        try buffer.flush();
    }
};
