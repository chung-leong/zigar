const std = @import("std");

const zigar = @import("zigar");

const worker = @import("search.zig");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const search = work_queue.promisify(worker.search);
pub const shutdown = work_queue.promisify(.shutdown);

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }
};
