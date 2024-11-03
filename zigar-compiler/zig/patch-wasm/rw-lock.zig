impl: Impl = .{},

const RwLock = @This();
const std = @import("std");
const builtin = @import("builtin");
const assert = std.debug.assert;

pub const Impl = if (builtin.single_threaded)
    SingleThreadedRwLock
else
    DefaultRwLock;

pub fn tryLock(rwl: *RwLock) bool {
    return rwl.impl.tryLock();
}

pub fn lock(rwl: *RwLock) void {
    return rwl.impl.lock();
}

pub fn unlock(rwl: *RwLock) void {
    return rwl.impl.unlock();
}

pub fn tryLockShared(rwl: *RwLock) bool {
    return rwl.impl.tryLockShared();
}

pub fn lockShared(rwl: *RwLock) void {
    return rwl.impl.lockShared();
}

pub fn unlockShared(rwl: *RwLock) void {
    return rwl.impl.unlockShared();
}

pub const SingleThreadedRwLock = struct {
    state: enum { unlocked, locked_exclusive, locked_shared } = .unlocked,
    shared_count: usize = 0,

    pub fn tryLock(rwl: *SingleThreadedRwLock) bool {
        switch (rwl.state) {
            .unlocked => {
                assert(rwl.shared_count == 0);
                rwl.state = .locked_exclusive;
                return true;
            },
            .locked_exclusive, .locked_shared => return false,
        }
    }

    pub fn lock(rwl: *SingleThreadedRwLock) void {
        assert(rwl.state == .unlocked); // deadlock detected
        assert(rwl.shared_count == 0); // corrupted state detected
        rwl.state = .locked_exclusive;
    }

    pub fn unlock(rwl: *SingleThreadedRwLock) void {
        assert(rwl.state == .locked_exclusive);
        assert(rwl.shared_count == 0); // corrupted state detected
        rwl.state = .unlocked;
    }

    pub fn tryLockShared(rwl: *SingleThreadedRwLock) bool {
        switch (rwl.state) {
            .unlocked => {
                rwl.state = .locked_shared;
                assert(rwl.shared_count == 0);
                rwl.shared_count = 1;
                return true;
            },
            .locked_shared => {
                rwl.shared_count += 1;
                return true;
            },
            .locked_exclusive => return false,
        }
    }

    pub fn lockShared(rwl: *SingleThreadedRwLock) void {
        switch (rwl.state) {
            .unlocked => {
                rwl.state = .locked_shared;
                assert(rwl.shared_count == 0);
                rwl.shared_count = 1;
            },
            .locked_shared => {
                rwl.shared_count += 1;
            },
            .locked_exclusive => unreachable, // deadlock detected
        }
    }

    pub fn unlockShared(rwl: *SingleThreadedRwLock) void {
        switch (rwl.state) {
            .unlocked => unreachable, // too many calls to `unlockShared`
            .locked_exclusive => unreachable, // exclusively held lock
            .locked_shared => {
                rwl.shared_count -= 1;
                if (rwl.shared_count == 0) {
                    rwl.state = .unlocked;
                }
            },
        }
    }
};

pub const DefaultRwLock = struct {
    state: usize = 0,
    mutex: std.Thread.Mutex = .{},
    semaphore: std.Thread.Semaphore = .{},

    const IS_WRITING: usize = 1;
    const WRITER: usize = 1 << 1;
    const READER: usize = 1 << (1 + @bitSizeOf(Count));
    const WRITER_MASK: usize = std.math.maxInt(Count) << @ctz(WRITER);
    const READER_MASK: usize = std.math.maxInt(Count) << @ctz(READER);
    const Count = std.meta.Int(.unsigned, @divFloor(@bitSizeOf(usize) - 1, 2));

    pub fn tryLock(rwl: *DefaultRwLock) bool {
        if (rwl.mutex.tryLock()) {
            const state = @atomicLoad(usize, &rwl.state, .seq_cst);
            if (state & READER_MASK == 0) {
                _ = @atomicRmw(usize, &rwl.state, .Or, IS_WRITING, .seq_cst);
                return true;
            }

            rwl.mutex.unlock();
        }

        return false;
    }

    pub fn lock(rwl: *DefaultRwLock) void {
        _ = @atomicRmw(usize, &rwl.state, .Add, WRITER, .seq_cst);
        rwl.mutex.lock();

        const state = @atomicRmw(usize, &rwl.state, .Add, IS_WRITING -% WRITER, .seq_cst);
        if (state & READER_MASK != 0)
            rwl.semaphore.wait();
    }

    pub fn unlock(rwl: *DefaultRwLock) void {
        _ = @atomicRmw(usize, &rwl.state, .And, ~IS_WRITING, .seq_cst);
        rwl.mutex.unlock();
    }

    pub fn tryLockShared(rwl: *DefaultRwLock) bool {
        const state = @atomicLoad(usize, &rwl.state, .seq_cst);
        if (state & (IS_WRITING | WRITER_MASK) == 0) {
            _ = @cmpxchgStrong(
                usize,
                &rwl.state,
                state,
                state + READER,
                .seq_cst,
                .seq_cst,
            ) orelse return true;
        }

        if (rwl.mutex.tryLock()) {
            _ = @atomicRmw(usize, &rwl.state, .Add, READER, .seq_cst);
            rwl.mutex.unlock();
            return true;
        }

        return false;
    }

    pub fn lockShared(rwl: *DefaultRwLock) void {
        var state = @atomicLoad(usize, &rwl.state, .seq_cst);
        while (state & (IS_WRITING | WRITER_MASK) == 0) {
            state = @cmpxchgWeak(
                usize,
                &rwl.state,
                state,
                state + READER,
                .seq_cst,
                .seq_cst,
            ) orelse return;
        }

        rwl.mutex.lock();
        _ = @atomicRmw(usize, &rwl.state, .Add, READER, .seq_cst);
        rwl.mutex.unlock();
    }

    pub fn unlockShared(rwl: *DefaultRwLock) void {
        const state = @atomicRmw(usize, &rwl.state, .Sub, READER, .seq_cst);

        if ((state & READER_MASK == READER) and (state & IS_WRITING != 0))
            rwl.semaphore.post();
    }
};
