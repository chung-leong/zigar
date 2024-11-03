const std = @import("std");
const builtin = @import("builtin");
const ResetEvent = @This();

const assert = std.debug.assert;
const Futex = @import("futex.zig");

impl: Impl = .{},

pub fn isSet(self: *const ResetEvent) bool {
    return self.impl.isSet();
}

pub fn wait(self: *ResetEvent) void {
    self.impl.wait(null) catch |err| switch (err) {
        error.Timeout => unreachable, // no timeout provided so we shouldn't have timed-out
    };
}

pub fn timedWait(self: *ResetEvent, timeout_ns: u64) error{Timeout}!void {
    return self.impl.wait(timeout_ns);
}

pub fn set(self: *ResetEvent) void {
    self.impl.set();
}

pub fn reset(self: *ResetEvent) void {
    self.impl.reset();
}

const Impl = if (builtin.single_threaded)
    SingleThreadedImpl
else
    FutexImpl;

const SingleThreadedImpl = struct {
    is_set: bool = false,

    fn isSet(self: *const Impl) bool {
        return self.is_set;
    }

    fn wait(self: *Impl, timeout: ?u64) error{Timeout}!void {
        if (self.isSet()) {
            return;
        }

        // There are no other threads to wake us up.
        // So if we wait without a timeout we would never wake up.
        const timeout_ns = timeout orelse {
            unreachable; // deadlock detected
        };

        std.time.sleep(timeout_ns);
        return error.Timeout;
    }

    fn set(self: *Impl) void {
        self.is_set = true;
    }

    fn reset(self: *Impl) void {
        self.is_set = false;
    }
};

const FutexImpl = struct {
    state: std.atomic.Value(u32) = std.atomic.Value(u32).init(unset),

    const unset = 0;
    const waiting = 1;
    const is_set = 2;

    fn isSet(self: *const Impl) bool {
        // Acquire barrier ensures memory accesses before set() happen before we return true.
        return self.state.load(.acquire) == is_set;
    }

    fn wait(self: *Impl, timeout: ?u64) error{Timeout}!void {
        // Outline the slow path to allow isSet() to be inlined
        if (!self.isSet()) {
            return self.waitUntilSet(timeout);
        }
    }

    fn waitUntilSet(self: *Impl, timeout: ?u64) error{Timeout}!void {
        // Try to set the state from `unset` to `waiting` to indicate
        // to the set() thread that others are blocked on the ResetEvent.
        // We avoid using any strict barriers until the end when we know the ResetEvent is set.
        var state = self.state.load(.acquire);
        if (state == unset) {
            state = self.state.cmpxchgStrong(state, waiting, .acquire, .acquire) orelse waiting;
        }

        // Wait until the ResetEvent is set since the state is waiting.
        if (state == waiting) {
            var futex_deadline = Futex.Deadline.init(timeout);
            while (true) {
                const wait_result = futex_deadline.wait(&self.state, waiting);

                // Check if the ResetEvent was set before possibly reporting error.Timeout below.
                state = self.state.load(.acquire);
                if (state != waiting) {
                    break;
                }

                try wait_result;
            }
        }

        assert(state == is_set);
    }

    fn set(self: *Impl) void {
        // Quick check if the ResetEvent is already set before doing the atomic swap below.
        // set() could be getting called quite often and multiple threads calling swap() increases contention unnecessarily.
        if (self.state.load(.monotonic) == is_set) {
            return;
        }

        // Mark the ResetEvent as set and unblock all waiters waiting on it if any.
        // Release barrier ensures memory accesses before set() happen before the ResetEvent is observed to be "set".
        if (self.state.swap(is_set, .release) == waiting) {
            Futex.wake(&self.state, std.math.maxInt(u32));
        }
    }

    fn reset(self: *Impl) void {
        self.state.store(unset, .monotonic);
    }
};
