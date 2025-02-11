const std = @import("std");
const zigar = @import("zigar");
const Mutex = @import("./WasmMainThreadMutex.zig");

const Promise = zigar.function.Promise(void);
const Signal = zigar.function.AbortSignal;
const allocator = zigar.mem.getDefaultAllocator();

var mutex = Mutex{};
var mainCount = std.atomic.Value(usize).init(0);
var workerCount = std.atomic.Value(usize).init(0);

pub fn lock() void {
    mutex.lock();
    _ = mainCount.fetchAdd(1, .monotonic);
}

pub fn unlock() void {
    defer mutex.unlock();
}

pub fn getCounts() [2]usize {
    return .{ mainCount.load(.monotonic), workerCount.load(.monotonic) };
}

pub fn startThreads(threads: usize, signal: Signal, promise: Promise) !void {
    const multipart_promise = try promise.partition(allocator, threads);
    for (0..threads) |_| {
        const thread = try std.Thread.spawn(.{
            .allocator = allocator,
            .stack_size = 64 * 1024,
        }, threadFn, .{ signal, multipart_promise });
        thread.detach();
    }
}

fn threadFn(signal: Signal, promise: Promise) void {
    while (signal.off()) {
        mutex.lock();
        defer mutex.unlock();
        _ = workerCount.fetchAdd(1, .monotonic);
    }
    promise.resolve({});
}
