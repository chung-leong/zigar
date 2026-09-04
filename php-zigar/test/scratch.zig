const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const startup = work_queue.promisify(.startup);
pub const shutdown = work_queue.promisify(.shutdown);
pub const print = work_queue.promisify(worker.print);

const worker = struct {
    pub fn print(path: []const u8) !usize {
        std.debug.print("{s}\n", .{path});
        return 1234;
    }
};
