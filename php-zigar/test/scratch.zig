const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub fn startup() !void {
    std.debug.print("starting up\n", .{});
    try work_queue.init(.{
        .allocator = std.heap.c_allocator,
        .n_jobs = 1,
    });
    std.debug.print("start-up complete\n", .{});
}
pub const create = work_queue.promisify(worker.create);

const worker = struct {
    pub fn create(allocator: std.mem.Allocator) ![]const u8 {
        std.Thread.sleep(5000000000);
        return try allocator.dupe(u8, "Hello world");
    }
};
