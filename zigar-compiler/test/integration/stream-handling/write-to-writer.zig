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

pub fn save(
    data: []const u8,
    writer: std.io.AnyWriter,
    promise: zigar.function.PromiseOf(ns.save),
) !void {
    try work_queue.push(ns.save, .{ data, writer }, promise);
}

const ns = struct {
    pub fn save(data: []const u8, writer: std.io.AnyWriter) !usize {
        return try writer.write(data);
    }
};
