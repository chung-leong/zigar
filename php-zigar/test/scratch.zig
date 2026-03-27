const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const startup = work_queue.promisify(.startup1);
pub const shutdown = work_queue.promisify(.shutdown);
pub const get = work_queue.asyncify(worker.get);

const Struct = struct {
    index: i32 = 0,

    pub fn next(self: *@This()) ?i32 {
        defer self.index += 1;
        std.Thread.sleep(100_000_000);
        return switch (self.index) {
            0 => 100,
            1 => 200,
            2 => 300,
            else => return null,
        };
    }
};

const worker = struct {
    pub fn get() !Struct {
        return .{};
    }
};
