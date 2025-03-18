const std = @import("std");
const host = @import("root").host;

pub const function = struct {
    pub const release = host.releaseFunction;

    pub const Promise = host.Promise;
    pub const PromiseArgOf = host.PromiseArgOf;
    pub const PromiseOf = host.PromiseOf;
    pub const Generator = host.Generator;
    pub const GeneratorArgOf = host.GeneratorArgOf;
    pub const GeneratorOf = host.GeneratorOf;
    pub const AbortSignal = host.AbortSignal;
};

pub const thread = struct {
    pub const use = host.startMultithread;
    pub const end = host.stopMultithread;
    pub const setParentId = host.setParentThreadId;

    pub const WorkQueue = host.WorkQueue;
};
