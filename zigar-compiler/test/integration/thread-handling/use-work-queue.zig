const std = @import("std");
const zigar = @import("zigar");

var gpa = std.heap.GeneralPurposeAllocator(.{}){};

var work_queue: zigar.thread.WorkQueue(ns) = .{};

pub fn startup(thread_count: usize) !void {
    try work_queue.init(.{
        .allocator = gpa.allocator(),
        .stack_size = 65536,
        .n_jobs = thread_count,
    });
}

pub fn shutdown(promise: zigar.function.Promise(void)) void {
    work_queue.deinitAsync(promise);
}

pub fn returnString(
    allocator: std.mem.Allocator,
    promise: zigar.function.PromiseOf(ns.returnString),
) !void {
    try work_queue.push(ns.returnString, .{allocator}, promise);
}

pub fn returnInt(
    promise: zigar.function.PromiseOf(ns.returnInt),
) !void {
    try work_queue.push(ns.returnInt, .{}, promise);
}

pub fn returnPoint(
    promise: zigar.function.PromiseOf(ns.returnPoint),
) !void {
    try work_queue.push(ns.returnPoint, .{}, promise);
}

const ns = struct {
    pub fn returnString(allocator: std.mem.Allocator) ![]const u8 {
        return try allocator.dupe(u8, "Hello world!");
    }

    pub fn returnInt() i32 {
        return 1234;
    }

    pub fn returnPoint() struct {
        x: f64,
        y: f64,
    } {
        return .{ .x = 0.1234, .y = 0.4567 };
    }
};

pub const @"meta(zigar)" = struct {
    pub fn isRetvalString(comptime func: anytype) bool {
        return @TypeOf(func) == @TypeOf(returnString) and func == returnString;
    }
};
