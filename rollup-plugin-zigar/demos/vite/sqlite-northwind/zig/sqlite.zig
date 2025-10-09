const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;

const zigar = @import("zigar");

const worker = @import("./worker.zig");

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub fn startup() !void {
    try work_queue.init(.{
        .allocator = wasm_allocator,
        .n_jobs = 1,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub const openDb = work_queue.promisify(worker.openDb);
pub const closeDb = work_queue.promisify(worker.closeDb);
pub const findCustomers = work_queue.promisify(worker.findCustomers);
pub const getOrders = work_queue.promisify(worker.getOrders);

pub const @"meta(zigar)" = struct {
    pub fn isFieldString(comptime T: type, comptime _: std.meta.FieldEnum(T)) bool {
        return true;
    }

    pub fn isDeclPlain(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
