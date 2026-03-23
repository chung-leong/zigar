const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const startup = work_queue.promisify(.startup1);
pub const shutdown = work_queue.promisify(.shutdown);
pub const get = work_queue.promisify(worker.get);

const worker = struct {
    pub fn get() i32 {
        std.Thread.sleep(1000000000);
        return 1234;
    }
};
