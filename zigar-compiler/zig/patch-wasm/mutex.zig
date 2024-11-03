const std = @import("std");
const builtin = @import("builtin");
const Mutex = @This();

const assert = std.debug.assert;
const Thread = @import("thread.zig");
const Futex = Thread.Futex;

impl: Impl = .{},

pub fn tryLock(self: *Mutex) bool {
    return self.impl.tryLock();
}

pub fn lock(self: *Mutex) void {
    self.impl.lock();
}

pub fn unlock(self: *Mutex) void {
    self.impl.unlock();
}

const Impl = if (builtin.mode == .Debug and !builtin.single_threaded)
    DebugImpl
else
    ReleaseImpl;

const ReleaseImpl = if (builtin.single_threaded)
    SingleThreadedImpl
else
    FutexImpl;

const DebugImpl = struct {
    locking_thread: std.atomic.Value(Thread.Id) = std.atomic.Value(Thread.Id).init(0), // 0 means it's not locked.
    impl: ReleaseImpl = .{},

    inline fn tryLock(self: *@This()) bool {
        const locking = self.impl.tryLock();
        if (locking) {
            self.locking_thread.store(Thread.getCurrentId(), .unordered);
        }
        return locking;
    }

    inline fn lock(self: *@This()) void {
        const current_id = Thread.getCurrentId();
        if (self.locking_thread.load(.unordered) == current_id and current_id != 0) {
            @panic("Deadlock detected");
        }
        self.impl.lock();
        self.locking_thread.store(current_id, .unordered);
    }

    inline fn unlock(self: *@This()) void {
        assert(self.locking_thread.load(.unordered) == Thread.getCurrentId());
        self.locking_thread.store(0, .unordered);
        self.impl.unlock();
    }
};

const SingleThreadedImpl = struct {
    is_locked: bool = false,

    fn tryLock(self: *@This()) bool {
        if (self.is_locked) return false;
        self.is_locked = true;
        return true;
    }

    fn lock(self: *@This()) void {
        if (!self.tryLock()) {
            unreachable; // deadlock detected
        }
    }

    fn unlock(self: *@This()) void {
        assert(self.is_locked);
        self.is_locked = false;
    }
};

const FutexImpl = struct {
    state: std.atomic.Value(u32) = std.atomic.Value(u32).init(unlocked),

    const unlocked: u32 = 0b00;
    const locked: u32 = 0b01;
    const contended: u32 = 0b11; // must contain the `locked` bit for x86 optimization below

    fn lock(self: *@This()) void {
        if (!self.tryLock())
            self.lockSlow();
    }

    fn tryLock(self: *@This()) bool {
        // On x86, use `lock bts` instead of `lock cmpxchg` as:
        // - they both seem to mark the cache-line as modified regardless: https://stackoverflow.com/a/63350048
        // - `lock bts` is smaller instruction-wise which makes it better for inlining
        if (comptime builtin.target.cpu.arch.isX86()) {
            const locked_bit = @ctz(locked);
            return self.state.bitSet(locked_bit, .acquire) == 0;
        }

        // Acquire barrier ensures grabbing the lock happens before the critical section
        // and that the previous lock holder's critical section happens before we grab the lock.
        return self.state.cmpxchgWeak(unlocked, locked, .acquire, .monotonic) == null;
    }

    fn lockSlow(self: *@This()) void {
        // Avoid doing an atomic swap below if we already know the state is contended.
        // An atomic swap unconditionally stores which marks the cache-line as modified unnecessarily.
        if (self.state.load(.monotonic) == contended) {
            Futex.wait(&self.state, contended);
        }

        // Try to acquire the lock while also telling the existing lock holder that there are threads waiting.
        //
        // Once we sleep on the Futex, we must acquire the mutex using `contended` rather than `locked`.
        // If not, threads sleeping on the Futex wouldn't see the state change in unlock and potentially deadlock.
        // The downside is that the last mutex unlocker will see `contended` and do an unnecessary Futex wake
        // but this is better than having to wake all waiting threads on mutex unlock.
        //
        // Acquire barrier ensures grabbing the lock happens before the critical section
        // and that the previous lock holder's critical section happens before we grab the lock.
        while (self.state.swap(contended, .acquire) != unlocked) {
            Futex.wait(&self.state, contended);
        }
    }

    fn unlock(self: *@This()) void {
        // Unlock the mutex and wake up a waiting thread if any.
        //
        // A waiting thread will acquire with `contended` instead of `locked`
        // which ensures that it wakes up another thread on the next unlock().
        //
        // Release barrier ensures the critical section happens before we let go of the lock
        // and that our critical section happens before the next lock holder grabs the lock.
        const state = self.state.swap(unlocked, .release);
        assert(state != unlocked);

        if (state == contended) {
            Futex.wake(&self.state, 1);
        }
    }
};
