const std = @import("std");

const zigar = @import("zigar");

const worker = @import("search.zig");
pub const @"meta(zigar)" = worker.@"meta(zigar)";

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const search = work_queue.promisify(worker.search);
pub const startup = work_queue.promisify(.startup);
pub const shutdown = work_queue.promisify(.shutdown);
