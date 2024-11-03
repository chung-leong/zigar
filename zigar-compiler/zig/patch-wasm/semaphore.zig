mutex: Mutex = .{},
cond: Condition = .{},
/// It is OK to initialize this field to any value.
permits: usize = 0,

const Semaphore = @This();
const std = @import("std");
const Mutex = @import("mutex.zig");
const Condition = @import("condition.zig");
const builtin = @import("builtin");

pub fn wait(sem: *Semaphore) void {
    sem.mutex.lock();
    defer sem.mutex.unlock();

    while (sem.permits == 0)
        sem.cond.wait(&sem.mutex);

    sem.permits -= 1;
    if (sem.permits > 0)
        sem.cond.signal();
}

pub fn timedWait(sem: *Semaphore, timeout_ns: u64) error{Timeout}!void {
    var timeout_timer = std.time.Timer.start() catch unreachable;

    sem.mutex.lock();
    defer sem.mutex.unlock();

    while (sem.permits == 0) {
        const elapsed = timeout_timer.read();
        if (elapsed > timeout_ns)
            return error.Timeout;

        const local_timeout_ns = timeout_ns - elapsed;
        try sem.cond.timedWait(&sem.mutex, local_timeout_ns);
    }

    sem.permits -= 1;
    if (sem.permits > 0)
        sem.cond.signal();
}

pub fn post(sem: *Semaphore) void {
    sem.mutex.lock();
    defer sem.mutex.unlock();

    sem.permits += 1;
    sem.cond.signal();
}
