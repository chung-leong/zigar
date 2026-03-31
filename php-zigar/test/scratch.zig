const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const startup = work_queue.promisify(.startup1);
pub const shutdown = work_queue.promisify(.shutdown);
pub const run = work_queue.asyncify(worker.run);

const worker = struct {
    pub fn run(signal: zigar.function.AbortSignal) void {
        while (signal.off()) {
            std.Thread.sleep(100_000_000);
            std.debug.print("Hello world\n", .{});
        }
    }
};
