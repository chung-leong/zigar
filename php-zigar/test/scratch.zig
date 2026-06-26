const std = @import("std");

const zigar = @import("zigar");

const worker = struct {
    pub fn getList(allocator: std.mem.Allocator) ![][]const u8 {
        const list = try allocator.alloc([]const u8, 10);
        for (list) |*ptr| ptr.* = try allocator.dupe(u8, "Hello world");
        return list;
    }

    pub fn getNumber() !i64 {
        return 1234;
    }

    pub fn getNumbers(allocator: std.mem.Allocator) ![]usize {
        const list = try allocator.alloc(usize, 10);
        for (list, 0..) |*ptr, i| ptr.* = (i + 1) * 5;
        std.debug.print("sending pointer {x}\n", .{@intFromPtr(list.ptr)});
        return list;
    }
};

var work_queue: zigar.thread.WorkQueue(worker) = .{};

pub const shutdown = work_queue.promisify(.shutdown);
pub const getList = work_queue.promisify(worker.getList);
pub const getNumber = work_queue.promisify(worker.getNumber);
pub const getNumbers = work_queue.promisify(worker.getNumbers);

pub const names: []const []const u8 = &.{
    "Agnieszka",
    "Basia",
    "Carmen",
};

pub fn getNames() []const []const u8 {
    return names;
}

pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime _: std.meta.DeclEnum(T)) bool {
        return true;
    }
};
