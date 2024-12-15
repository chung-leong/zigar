const std = @import("std");
const host = @import("root").host;
const job_queue = @import("job-queue.zig");

pub const function = struct {
    pub fn release(fn_ptr: anytype) void {
        host.releaseFunction(fn_ptr) catch {};
    }
    pub fn Promise(comptime T: type) type {
        return host.Promise(T);
    }
    pub const AbortSignal = host.AbortSignal;
};

pub const thread = struct {
    pub fn use(state: bool) !void {
        try host.setMultithread(state);
    }

    pub const JobQueue = job_queue.JobQueue;
};

pub const mem = struct {
    pub fn getDefaultAllocator() std.mem.Allocator {
        return host.getDefaultAllocator();
    }
};
