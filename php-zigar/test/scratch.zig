const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const create = work_queue.promisify(worker.create);

const worker = struct {
    pub fn create(allocator: std.mem.Allocator) ![]const u8 {
        return try allocator.dupe(u8, "Hello world");
    }
};
