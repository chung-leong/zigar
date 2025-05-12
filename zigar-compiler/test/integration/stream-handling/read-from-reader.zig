const std = @import("std");
const zigar = @import("zigar");

// pub const List = std.ArrayList(u8);

pub const Reader = std.io.AnyReader;

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

pub fn output(
    reader: std.io.AnyReader,
    promise: zigar.function.PromiseOf(ns.output),
) !void {
    try work_queue.push(ns.output, .{reader}, promise);
}

const ns = struct {
    pub fn output(reader: std.io.AnyReader) !void {
        const stdout = std.io.getStdOut();
        var buffer: [128]u8 = undefined;
        while (true) {
            const read = reader.read(&buffer) catch |err| show: {
                std.debug.print("error: {s}", .{@errorName(err)});
                break :show 0;
            };
            if (read == 0) break;
            _ = try stdout.write(buffer[0..read]);
        }
    }
};
