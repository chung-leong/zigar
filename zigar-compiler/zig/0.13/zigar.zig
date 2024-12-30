const std = @import("std");
const host = @import("root").host;

pub const function = struct {
    pub fn release(fn_ptr: anytype) void {
        host.releaseFunction(fn_ptr) catch {};
    }

    pub const Promise = host.Promise;
    pub const PromiseOf = host.PromiseOf;
    pub const AbortSignal = host.AbortSignal;
};

pub const thread = struct {
    pub fn use(state: bool) !void {
        try host.setMultithread(state);
    }

    pub const JobQueue = host.JobQueue;
};

pub const mem = struct {
    pub fn getDefaultAllocator() std.mem.Allocator {
        return host.getDefaultAllocator();
    }
};
