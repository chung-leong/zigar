const std = @import("std");
const builtin = @import("builtin");
const Condition = @This();
const Mutex = @import("mutex.zig");

const assert = std.debug.assert;
const Futex = @import("futex.zig");

impl: Impl = .{},

pub fn wait(self: *Condition, mutex: *Mutex) void {
    self.impl.wait(mutex, null) catch |err| switch (err) {
        error.Timeout => unreachable, // no timeout provided so we shouldn't have timed-out
    };
}

pub fn timedWait(self: *Condition, mutex: *Mutex, timeout_ns: u64) error{Timeout}!void {
    return self.impl.wait(mutex, timeout_ns);
}

pub fn signal(self: *Condition) void {
    self.impl.wake(.one);
}

pub fn broadcast(self: *Condition) void {
    self.impl.wake(.all);
}

const Impl = if (builtin.single_threaded)
    SingleThreadedImpl
else
    FutexImpl;

const Notify = enum {
    one, // wake up only one thread
    all, // wake up all threads
};

const SingleThreadedImpl = struct {
    fn wait(self: *Impl, mutex: *Mutex, timeout: ?u64) error{Timeout}!void {
        _ = self;
        _ = mutex;

        // There are no other threads to wake us up.
        // So if we wait without a timeout we would never wake up.
        const timeout_ns = timeout orelse {
            unreachable; // deadlock detected
        };

        std.time.sleep(timeout_ns);
        return error.Timeout;
    }

    fn wake(self: *Impl, comptime notify: Notify) void {
        // There are no other threads to wake up.
        _ = self;
        _ = notify;
    }
};

const FutexImpl = struct {
    state: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),
    epoch: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),

    const one_waiter = 1;
    const waiter_mask = 0xffff;

    const one_signal = 1 << 16;
    const signal_mask = 0xffff << 16;

    fn wait(self: *Impl, mutex: *Mutex, timeout: ?u64) error{Timeout}!void {
        // Observe the epoch, then check the state again to see if we should wake up.
        // The epoch must be observed before we check the state or we could potentially miss a wake() and deadlock:
        //
        // - T1: s = LOAD(&state)
        // - T2: UPDATE(&s, signal)
        // - T2: UPDATE(&epoch, 1) + FUTEX_WAKE(&epoch)
        // - T1: e = LOAD(&epoch) (was reordered after the state load)
        // - T1: s & signals == 0 -> FUTEX_WAIT(&epoch, e) (missed the state update + the epoch change)
        //
        // Acquire barrier to ensure the epoch load happens before the state load.
        var epoch = self.epoch.load(.acquire);
        var state = self.state.fetchAdd(one_waiter, .monotonic);
        assert(state & waiter_mask != waiter_mask);
        state += one_waiter;

        mutex.unlock();
        defer mutex.lock();

        var futex_deadline = Futex.Deadline.init(timeout);

        while (true) {
            futex_deadline.wait(&self.epoch, epoch) catch |err| switch (err) {
                // On timeout, we must decrement the waiter we added above.
                error.Timeout => {
                    while (true) {
                        // If there's a signal when we're timing out, consume it and report being woken up instead.
                        // Acquire barrier ensures code before the wake() which added the signal happens before we decrement it and return.
                        while (state & signal_mask != 0) {
                            const new_state = state - one_waiter - one_signal;
                            state = self.state.cmpxchgWeak(state, new_state, .acquire, .monotonic) orelse return;
                        }

                        // Remove the waiter we added and officially return timed out.
                        const new_state = state - one_waiter;
                        state = self.state.cmpxchgWeak(state, new_state, .monotonic, .monotonic) orelse return err;
                    }
                },
            };

            epoch = self.epoch.load(.acquire);
            state = self.state.load(.monotonic);

            // Try to wake up by consuming a signal and decremented the waiter we added previously.
            // Acquire barrier ensures code before the wake() which added the signal happens before we decrement it and return.
            while (state & signal_mask != 0) {
                const new_state = state - one_waiter - one_signal;
                state = self.state.cmpxchgWeak(state, new_state, .acquire, .monotonic) orelse return;
            }
        }
    }

    fn wake(self: *Impl, comptime notify: Notify) void {
        var state = self.state.load(.monotonic);
        while (true) {
            const waiters = (state & waiter_mask) / one_waiter;
            const signals = (state & signal_mask) / one_signal;

            // Reserves which waiters to wake up by incrementing the signals count.
            // Therefore, the signals count is always less than or equal to the waiters count.
            // We don't need to Futex.wake if there's nothing to wake up or if other wake() threads have reserved to wake up the current waiters.
            const wakeable = waiters - signals;
            if (wakeable == 0) {
                return;
            }

            const to_wake = switch (notify) {
                .one => 1,
                .all => wakeable,
            };

            // Reserve the amount of waiters to wake by incrementing the signals count.
            // Release barrier ensures code before the wake() happens before the signal it posted and consumed by the wait() threads.
            const new_state = state + (one_signal * to_wake);
            state = self.state.cmpxchgWeak(state, new_state, .release, .monotonic) orelse {
                // Wake up the waiting threads we reserved above by changing the epoch value.
                // NOTE: a waiting thread could miss a wake up if *exactly* ((1<<32)-1) wake()s happen between it observing the epoch and sleeping on it.
                // This is very unlikely due to how many precise amount of Futex.wake() calls that would be between the waiting thread's potential preemption.
                //
                // Release barrier ensures the signal being added to the state happens before the epoch is changed.
                // If not, the waiting thread could potentially deadlock from missing both the state and epoch change:
                //
                // - T2: UPDATE(&epoch, 1) (reordered before the state change)
                // - T1: e = LOAD(&epoch)
                // - T1: s = LOAD(&state)
                // - T2: UPDATE(&state, signal) + FUTEX_WAKE(&epoch)
                // - T1: s & signals == 0 -> FUTEX_WAIT(&epoch, e) (missed both epoch change and state change)
                _ = self.epoch.fetchAdd(1, .release);
                Futex.wake(&self.epoch, to_wake);
                return;
            };
        }
    }
};
