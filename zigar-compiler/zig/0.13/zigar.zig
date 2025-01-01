const std = @import("std");
const host = @import("root").host;

pub const function = struct {
    pub const release = host.releaseFunction;

    pub const Promise = host.Promise;
    pub const PromiseOf = host.PromiseOf;
    pub const AbortSignal = host.AbortSignal;
};

pub const thread = struct {
    pub const use = host.startMultithread;
    pub const end = host.stopMultithread;
    
    pub const WorkQueue = host.WorkQueue;
    pub const Queue = host.Queue;
};

pub const mem = struct {
    pub const getDefaultAllocator = host.getDefaultAllocator;
};
