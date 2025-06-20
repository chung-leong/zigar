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

pub fn hash(
    reader: std.io.AnyReader,
    promise: zigar.function.PromiseOf(ns.hash),
) !void {
    try work_queue.push(ns.hash, .{reader}, promise);
}

const ns = struct {
    pub fn hash(reader: std.io.AnyReader) ![std.crypto.hash.Sha1.digest_length * 2]u8 {
        var buffer: [128]u8 = undefined;
        var sha1: std.crypto.hash.Sha1 = .init(.{});
        var count: u32 = 0;
        while (true) {
            const read = try reader.read(&buffer);
            if (read == 0) break;
            sha1.update(buffer[0..read]);
            count += 1;
        }
        const digest = sha1.finalResult();
        return std.fmt.bytesToHex(digest, .lower);
    }
};
