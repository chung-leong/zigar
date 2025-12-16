const std = @import("std");

const zigar = @import("zigar");

pub const database = @import("./database.zig");
pub const @"meta(zigar)" = @import("./meta.zig");

var work_queue: zigar.thread.WorkQueue(database) = .{};

pub const remote = struct {
    pub const shutdown = work_queue.promisify(.shutdown);
    pub const open = work_queue.promisify(database.open);
    pub const close = work_queue.promisify(database.close);
    pub const getPosts = work_queue.promisify(database.getPosts);
};
