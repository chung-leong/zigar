const std = @import("std");
const zigar = @import("zigar");

const Reporter = fn (usize, usize) void;
const Promise = zigar.function.Promise(void);
const Signal = zigar.function.AbortSignal;
const allocator = zigar.mem.getDefaultAllocator();

pub fn runTest(count: usize, iterations: usize) !usize {
    var prng = std.Random.Xoshiro256.init(count);
    var random = std.Random.init(&prng, std.Random.Xoshiro256.fill);
    var i: usize = 0;
    while (i < iterations) : (i += 1) {
        const random_amount = random.uintAtMost(usize, 8 * 1024);
        const slice = try allocator.alloc(u8, random_amount);
        allocator.free(slice);
    }
    return count + i;
}

pub fn startThreads(count: usize, iterations: usize, reporter: *const Reporter, signal: Signal, promise: Promise) !void {
    const multipart_promise = try promise.partition(allocator, count);
    for (0..count) |i| {
        const thread = try std.Thread.spawn(.{
            .allocator = allocator,
            .stack_size = 64 * 1024,
        }, threadFn, .{
            i + 1,
            iterations,
            reporter,
            signal,
            multipart_promise,
        });
        thread.detach();
    }
}

fn threadFn(id: usize, iterations: usize, reporter: *const Reporter, signal: Signal, promise: Promise) void {
    var count: usize = 0;
    while (signal.off()) {
        if (runTest(count, iterations)) |new_count| {
            count = new_count;
            reporter(id, count);
        } else |_| {
            break;
        }
    }
    promise.resolve({});
}
