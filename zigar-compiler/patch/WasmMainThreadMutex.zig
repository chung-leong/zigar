//! WasmMainThreadMutex is mutex designed to work in the browser environment, where the main thread
//! is not allowed to wait synchronously.
//!
//! Upon encountering a locked mutex, the main thread would spin in-place until it is unlocked by
//! the current owner. Requests by the main thread preempt those made by other waiting threads so
//! that the amount of spinning is minimized.

const std = @import("std");
const builtin = @import("builtin");
const WasmMainThreadMutex = @This();

const testing = std.testing;
const Thread = std.Thread;

const Status = enum(u32) {
    // no one owns the lock
    free,
    // a worker thread has the lock
    owned,
    // the main thread either has the lock already or is about to get it
    seized,
    // the main thread has received the lock from the previous owner
    forfeited,
};

/// Acquires the mutex, blocking the caller's thread until it can.
/// It is undefined behavior if the mutex is already held by the caller's thread.
/// Once acquired, call `unlock()` on the mutex to release it.
pub fn lock(self: *WasmMainThreadMutex) void {
    if (builtin.single_threaded) return;
    if (inMainThread()) {
        // announce that the lock will be taken by the main thread
        switch (self.status.swap(.seized, .acquire)) {
            // seizing a free lock
            .free => {},
            // keep spinning until the current owner surrenders it
            .owned => while (self.status.load(.monotonic) != .forfeited) {},
            else => unreachable,
        }
    } else {
        while (true) {
            // try to get the lock
            if (self.status.cmpxchgWeak(.free, .owned, .acquire, .monotonic)) |status| {
                // pause the worker when the lock is not free
                if (status != .free) {
                    const u32_ptr: *const std.atomic.Value(u32) = @ptrCast(&self.status);
                    _ = self.wait_count.fetchAdd(1, .monotonic);
                    Thread.Futex.wait(u32_ptr, @intFromEnum(status));
                    _ = self.wait_count.fetchSub(1, .monotonic);
                }
            } else break;
        }
    }
}

/// Releases the mutex which was previously acquired with `lock()` or `tryLock()`.
/// It is undefined behavior if the mutex is unlocked from a different thread that it was locked from.
pub fn unlock(self: *WasmMainThreadMutex) void {
    if (builtin.single_threaded) return;
    if (inMainThread()) {
        // just release the lock
        self.status.store(.free, .release);
    } else {
        // release the lock if the worker thread still owns it
        if (self.status.cmpxchgStrong(.owned, .free, .release, .monotonic)) |status| {
            switch (status) {
                .seized => {
                    // let the spinning main thread take the lock
                    self.status.store(.forfeited, .release);
                    return;
                },
                else => unreachable,
            }
        }
    }
    if (self.wait_count.load(.monotonic) > 0) {
        // awaken a waiting worker thread
        const u32_ptr: *const std.atomic.Value(u32) = @ptrCast(&self.status);
        Thread.Futex.wake(u32_ptr, 1);
    }
}

/// Tries to acquire the mutex without blocking the caller's thread.
/// Returns `false` if the calling thread would have to block to acquire it.
/// Otherwise, returns `true` and the caller should `unlock()` the mutex to release it.
pub fn tryLock(self: *WasmMainThreadMutex) bool {
    if (builtin.single_threaded) return true;
    const new_status: Status = if (inMainThread()) .seized else .owned;
    return self.status.cmpxchgStrong(.free, new_status, .acquire, .monotonic) == null;
}

/// Sets the id of the main thread. A call to this function is only necessary when
/// WasmMainThreadMutex is used in platforms other than Wasm.
pub fn setMainThreadId(id: Thread.Id) void {
    main_thread_id = id;
}

var main_thread_id: Thread.Id = 0;

fn inMainThread() bool {
    return Thread.getCurrentId() == main_thread_id;
}

status: switch (builtin.single_threaded) {
    false => std.atomic.Value(Status),
    true => void,
} = switch (builtin.single_threaded) {
    false => .{ .raw = .free },
    true => {},
},
wait_count: switch (builtin.single_threaded) {
    false => std.atomic.Value(u32),
    true => void,
} = switch (builtin.single_threaded) {
    false => .{ .raw = 0 },
    true => {},
},

test "smoke test (main thread)" {
    setMainThreadId(Thread.getCurrentId());
    var mutex = WasmMainThreadMutex{};

    try testing.expect(mutex.tryLock());
    try testing.expect(!mutex.tryLock());
    mutex.unlock();

    mutex.lock();
    try testing.expect(!mutex.tryLock());
    mutex.unlock();
}

test "smoke test (worker thread)" {
    setMainThreadId(~Thread.getCurrentId());
    var mutex = WasmMainThreadMutex{};

    try testing.expect(mutex.tryLock());
    try testing.expect(!mutex.tryLock());
    mutex.unlock();

    mutex.lock();
    try testing.expect(!mutex.tryLock());
    mutex.unlock();
}

// A counter which is incremented without atomic instructions
const NonAtomicCounter = struct {
    // direct u128 could maybe use xmm ops on x86 which are atomic
    value: [2]u64 = [_]u64{ 0, 0 },

    fn get(self: NonAtomicCounter) u128 {
        return @as(u128, @bitCast(self.value));
    }

    fn inc(self: *NonAtomicCounter) void {
        for (@as([2]u64, @bitCast(self.get() + 1)), 0..) |v, i| {
            @as(*volatile u64, @ptrCast(&self.value[i])).* = v;
        }
    }
};

test "many uncontended" {
    // This test requires spawning threads.
    if (builtin.single_threaded) {
        return error.SkipZigTest;
    }
    setMainThreadId(Thread.getCurrentId());

    const num_threads = 4;
    const num_increments = 5000;

    const Runner = struct {
        mutex: WasmMainThreadMutex = .{},
        thread: Thread = undefined,
        counter: NonAtomicCounter = .{},

        fn run(self: *@This()) void {
            var i: usize = num_increments;
            while (i > 0) : (i -= 1) {
                self.mutex.lock();
                defer self.mutex.unlock();

                self.counter.inc();
            }
        }
    };

    var runners = [_]Runner{.{}} ** num_threads;
    for (&runners) |*r| r.thread = try Thread.spawn(.{}, Runner.run, .{r});
    var mt_runner = Runner{};
    mt_runner.run();
    for (runners) |r| r.thread.join();
    for (runners) |r| try testing.expectEqual(r.counter.get(), num_increments);
    try testing.expectEqual(mt_runner.counter.get(), num_increments);
}

test "many contended" {
    // This test requires spawning threads.
    if (builtin.single_threaded) {
        return error.SkipZigTest;
    }
    setMainThreadId(~Thread.getCurrentId());

    const num_threads = 4;
    const num_increments = 5000;

    const Runner = struct {
        mutex: WasmMainThreadMutex = .{},
        counter: NonAtomicCounter = .{},

        fn run(self: *@This()) void {
            var i: usize = num_increments;
            while (i > 0) : (i -= 1) {
                // Occasionally hint to let another thread run.
                defer if (i % 100 == 0) Thread.yield() catch {};

                self.mutex.lock();
                defer self.mutex.unlock();

                self.counter.inc();
            }
        }
    };

    var runner = Runner{};

    var threads: [num_threads]Thread = undefined;
    for (&threads) |*t| t.* = try Thread.spawn(.{}, Runner.run, .{&runner});
    runner.run();
    for (threads) |t| t.join();

    try testing.expectEqual(runner.counter.get(), num_increments * (num_threads + 1));
}

test "lock seizure by main thread" {
    // This test requires spawning threads.
    if (builtin.single_threaded) {
        return error.SkipZigTest;
    }
    setMainThreadId(Thread.getCurrentId());

    const num_threads = 10;

    const Runner = struct {
        var mutex: WasmMainThreadMutex = .{};
        var thread_count = std.atomic.Value(u32).init(0);
        var status = std.atomic.Value(u32).init(0);
        var array = [1]u8{' '} ** (num_threads * 2 + 3);
        var index: usize = 0;

        fn run() void {
            if (thread_count.fetchAdd(1, .monotonic) == num_threads - 1) {
                status.store(1, .monotonic);
                Thread.Futex.wake(&status, 1);
            }
            mutex.lock();
            Thread.sleep(2_000_000);
            array[index] = 'T';
            index += 1;
            mutex.unlock();
        }

        fn main() !void {
            mutex.lock();
            var threads: [num_threads]Thread = undefined;
            for (&threads) |*t| t.* = try Thread.spawn(.{}, run, .{});
            Thread.Futex.wait(&status, 0);

            // release the lock and wait 1ms, allowing one thread to get the lock
            array[index] = 'A';
            index += 1;
            mutex.unlock();
            Thread.sleep(1_000_000);
            // demand the lock
            mutex.lock();
            array[index] = 'B';
            index += 1;
            // release the lock again and wait 3ms this time, allowing two threads to get the lock
            mutex.unlock();
            Thread.sleep(3_000_000);
            // acquire the lock once more
            mutex.lock();
            array[index] = 'C';
            index += 1;
            mutex.unlock();

            for (threads) |t| t.join();
        }
    };

    try Runner.main();
    try testing.expect(Runner.index == num_threads + 3);
    try testing.expectEqualStrings(Runner.array[0..6], "ATBTTC");
}
