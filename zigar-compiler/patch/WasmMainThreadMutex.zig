const std = @import("std");
const builtin = @import("builtin");

const State = enum(u32) {
    free, // no one owns the lock
    owned, // a worker thread has the lock
    seized, // the main thread either has the lock already or is about to get it
    forfeited, // the main thread has received the lock from the previous owner
};

pub fn lock(self: *@This()) void {
    if (builtin.single_threaded) return;
    if (inMainThread()) {
        // announce that the lock will be taken by the main thread
        if (self.value.swap(.seized, .acquire) == .owned) {
            // keep spinning until the current owner surrenders it
            while (self.value.load(.monotonic) != .forfeited) {}
        }
    } else {
        while (true) {
            // try to get the lock
            if (self.value.cmpxchgWeak(.free, .owned, .acquire, .monotonic)) |state| {
                // pause the worker when it's not .free
                if (state != .free) self.pauseWorker(state);
            } else break;
        }
    }
}

pub fn unlock(self: *@This()) void {
    if (builtin.single_threaded) return;
    if (inMainThread()) {
        // release the lock and wake any waiting worker
        self.value.store(.free, .release);
        self.wakeWorker();
    } else {
        // release the lock, then check if it hasn't been seized
        if (self.value.swap(.free, .release) == .seized) {
            // let the spinning main thread take the lock
            self.value.store(.forfeited, .monotonic);
        } else {
            // wake any waiting worker
            self.wakeWorker();
        }
    }
}

pub fn tryLock(self: *@This()) bool {
    if (builtin.single_threaded) return true;
    const new_state: State = if (inMainThread()) .seized else .owned;
    while (true) {
        // try to get the lock
        if (self.value.cmpxchgWeak(.free, new_state, .acquire, .monotonic)) |state| {
            if (state != .free) return false;
        } else return true;
    }
}

fn wakeWorker(self: *@This()) void {
    if (self.wait_count.load(.monotonic) > 0) {
        // awaken a waiting worker thread
        const u32_ptr: *const std.atomic.Value(u32) = @ptrCast(&self.value);
        std.Thread.Futex.wake(u32_ptr, 1);
    }
}

fn pauseWorker(self: *@This(), current_state: State) void {
    const u32_ptr: *const std.atomic.Value(u32) = @ptrCast(&self.value);
    _ = self.wait_count.fetchAdd(1, .monotonic);
    std.Thread.Futex.wait(u32_ptr, @intFromEnum(current_state));
    _ = self.wait_count.fetchSub(1, .monotonic);
}

var process_id: ?u32 = null;

fn getMainThreadId() u32 {
    return switch (builtin.target.os.tag) {
        .linux => process_id orelse get: {
            process_id = @intCast(std.os.linux.getpid());
            break :get process_id.?;
        },
        else => 0,
    };
}

fn inMainThread() bool {
    return std.Thread.getCurrentId() == getMainThreadId();
}

value: switch (builtin.single_threaded) {
    false => std.atomic.Value(State),
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
    // acquire the lock
    try expect(mutex.tryLock() == true);
    // spawn a bunch of threads
    var thread_count = std.atomic.Value(u32).init(0);
    var threads: [8]std.Thread = undefined;
    var array = [1]u8{' '} ** 16;
    var index: usize = 0;
    for (&threads) |*thread_ptr| {
        const ns = struct {
            fn run(
                mutex_ptr: *Mutex,
                array_ptr: []u8,
                index_ptr: *usize,
                thread_count_ptr: *std.atomic.Value(u32),
            ) !void {
                _ = thread_count_ptr.fetchAdd(1, .monotonic);
                std.Thread.Futex.wake(thread_count_ptr, 1);
                try expect(mutex_ptr.tryLock() == false);
                mutex_ptr.lock();
                std.Thread.sleep(20 * 1000);
                array_ptr[index_ptr.*] = 'T';
                index_ptr.* += 1;
                mutex_ptr.unlock();
            }
        };
        thread_ptr.* = try std.Thread.spawn(.{}, ns.run, .{
            &mutex,
            &array,
            &index,
            &thread_count,
        });
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
    mutex.lock();
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
}
