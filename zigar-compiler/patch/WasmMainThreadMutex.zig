const std = @import("std");
const builtin = @import("builtin");

const Status = enum(u32) {
    free, // no one owns the lock
    owned, // a worker thread has the lock
    seized, // the main thread either has the lock already or is about to get it
    forfeited, // the main thread has received the lock from the previous owner
};

pub fn lock(self: *@This()) void {
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
                // pause the worker when it's not .free
                if (status != .free) {
                    const u32_ptr: *const std.atomic.Value(u32) = @ptrCast(&self.status);
                    _ = self.wait_count.fetchAdd(1, .monotonic);
                    std.Thread.Futex.wait(u32_ptr, @intFromEnum(status));
                    _ = self.wait_count.fetchSub(1, .monotonic);
                }
            } else break;
        }
    }
}

pub fn unlock(self: *@This()) void {
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
        std.Thread.Futex.wake(u32_ptr, 1);
    }
}

pub fn tryLock(self: *@This()) bool {
    if (builtin.single_threaded) return true;
    const new_status: Status = if (inMainThread()) .seized else .owned;
    return self.status.cmpxchgStrong(.free, new_status, .acquire, .monotonic) == null;
}

pub fn setMainThreadId(id: std.Thread.Id) void {
    main_thread_id = id;
}

var main_thread_id: std.Thread.Id = 0;

fn inMainThread() bool {
    return std.Thread.getCurrentId() == main_thread_id;
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

test {
    const expect = std.testing.expect;
    const Mutex = @This();
    var mutex: Mutex = .{};
    setMainThreadId(std.Thread.getCurrentId());
    // acquire the lock
    try expect(mutex.tryLock() == true);
    // spawn a bunch of threads
    var threads: [8]std.Thread = undefined;
    var thread_count = std.atomic.Value(u32).init(0);
    var array = [1]u8{' '} ** 16;
    var index: usize = 0;
    for (&threads, 0..) |*thread_ptr, thread_index| {
        const ns = struct {
            fn run1(
                mutex_ptr: *Mutex,
                array_ptr: []u8,
                index_ptr: *usize,
                thread_count_ptr: *std.atomic.Value(u32),
            ) !void {
                _ = thread_count_ptr.fetchAdd(1, .monotonic);
                std.Thread.Futex.wake(thread_count_ptr, 1);
                mutex_ptr.lock();
                std.Thread.sleep(20 * 1000);
                array_ptr[index_ptr.*] = 'T';
                index_ptr.* += 1;
                mutex_ptr.unlock();
            }

            fn run2(
                mutex_ptr: *Mutex,
                array_ptr: []u8,
                index_ptr: *usize,
                thread_count_ptr: *std.atomic.Value(u32),
            ) !void {
                _ = thread_count_ptr.fetchAdd(1, .monotonic);
                std.Thread.Futex.wake(thread_count_ptr, 1);
                // use tryLock() here
                while (true) {
                    if (mutex_ptr.tryLock()) {
                        std.Thread.sleep(20 * 1000);
                        array_ptr[index_ptr.*] = 'T';
                        index_ptr.* += 1;
                        mutex_ptr.unlock();
                        break;
                    } else {
                        std.Thread.sleep(1000);
                    }
                }
            }
        };
        const options: std.Thread.SpawnConfig = .{ .stack_size = 1024 * 1024 };
        const args = .{
            &mutex,
            &array,
            &index,
            &thread_count,
        };
        if (thread_index & 1 == 0) {
            thread_ptr.* = try std.Thread.spawn(options, ns.run1, args);
        } else {
            thread_ptr.* = try std.Thread.spawn(options, ns.run2, args);
        }
    }
    while (true) {
        const count = thread_count.load(.monotonic);
        if (count == threads.len) break;
        std.Thread.Futex.wait(&thread_count, count);
    }
    // wait for threads to queue up for the lock
    std.Thread.sleep(50 * 1000);
    // release the lock and wait 10ms, allowing one thread to get the lock
    array[index] = 'A';
    index += 1;
    mutex.unlock();
    std.Thread.sleep(10 * 1000);
    // demand the lock
    mutex.lock();
    array[index] = 'B';
    index += 1;
    // release the lock again and wait 50ms this time, allowing two threads to get the lock
    mutex.unlock();
    std.Thread.sleep(50 * 1000);
    // acquire the lock once more
    if (!mutex.tryLock()) {
        mutex.lock();
    }
    array[index] = 'C';
    index += 1;
    mutex.unlock();
    // wait for threads to terminate
    for (threads) |thread| {
        thread.join();
    }
    try expect(index == threads.len + 3);
    const a_index = std.mem.indexOfScalar(u8, &array, 'A').?;
    const b_index = std.mem.indexOfScalar(u8, &array, 'B').?;
    const c_index = std.mem.indexOfScalar(u8, &array, 'C').?;
    try expect(a_index == 0);
    // sleep() is not precise, so the second attempt by the main thread to get the lock could
    // happen after 1 or 2 worker threads have gotten it first
    try expect(switch (b_index - a_index) {
        1, 2, 3 => true,
        else => false,
    });
    // C should be set after two threads have gotten the lock, but it could be less or more
    try expect(switch (c_index - b_index) {
        1, 2, 3 => true,
        else => false,
    });
    try expect(mutex.tryLock() == true);
    mutex.unlock();

    // acquiring and releaseing the lock continuously for a while
    var running = true;
    for (&threads) |*thread_ptr| {
        const ns = struct {
            fn run3(
                mutex_ptr: *Mutex,
                running_ptr: *bool,
            ) void {
                while (running_ptr.*) {
                    mutex_ptr.lock();
                    defer mutex_ptr.unlock();
                }
            }
        };
        const options: std.Thread.SpawnConfig = .{ .stack_size = 1024 * 1024 };
        const args = .{ &mutex, &running };
        thread_ptr.* = try std.Thread.spawn(options, ns.run3, args);
    }
    var count: usize = 0;
    while (count < 50000) {
        mutex.lock();
        defer mutex.unlock();
        count += 1;
    }
    running = false;
    for (threads) |thread| {
        thread.join();
    }
}
