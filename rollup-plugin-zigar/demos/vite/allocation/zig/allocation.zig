const std = @import("std");
const zigar = @import("zigar");

const Promise = zigar.function.Promise(void);
const Signal = zigar.function.AbortSignal;
const allocator = zigar.mem.getDefaultAllocator();

var mainCount = std.atomic.Value(usize).init(0);
var workerCount = std.atomic.Value(usize).init(0);
var prng = std.Random.Xoshiro256.init(0);
var random = std.Random.init(&prng, std.Random.Xoshiro256.fill);

pub fn testMain(iterations: usize) !void {
    try runTest(iterations);
    _ = mainCount.fetchAdd(iterations, .monotonic);
}

fn runTest(iterations: usize) !void {
    var i: usize = 0;
    while (i < iterations) : (i += 1) {
        const random_amount = random.uintAtMost(usize, 8 * 1024);
        const slice = try allocator.alloc(u8, random_amount);
        allocator.free(slice);
    }
}

pub fn getCounts() [2]usize {
    return .{ mainCount.load(.monotonic), workerCount.load(.monotonic) };
}

pub fn startThreads(count: usize, iterations: usize, signal: Signal, promise: Promise) !void {
    const multipart_promise = try promise.partition(allocator, count);
    for (0..count) |_| {
        const thread = try std.Thread.spawn(.{
            .allocator = allocator,
            .stack_size = 64 * 1024,
        }, threadFn, .{ iterations, signal, multipart_promise });
        thread.detach();
    }
}

fn threadFn(iterations: usize, signal: Signal, promise: Promise) void {
    while (signal.off()) {
        runTest(iterations) catch break;
        _ = workerCount.fetchAdd(iterations, .monotonic);
    }
    promise.resolve({});
}
