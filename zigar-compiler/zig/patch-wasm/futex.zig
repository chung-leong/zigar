const std = @import("std");
const builtin = @import("builtin");
const Futex = @This();

const assert = std.debug.assert;
const atomic = std.atomic;

pub fn wait(ptr: *const atomic.Value(u32), expect: u32) void {
    Impl.wait(ptr, expect, null) catch |err| switch (err) {
        error.Timeout => unreachable, // null timeout meant to wait forever
    };
}

pub fn timedWait(ptr: *const atomic.Value(u32), expect: u32, timeout_ns: u64) error{Timeout}!void {
    // Avoid calling into the OS for no-op timeouts.
    if (timeout_ns == 0) {
        if (ptr.load(.seq_cst) != expect) return;
        return error.Timeout;
    }

    return Impl.wait(ptr, expect, timeout_ns);
}

/// Unblocks at most `max_waiters` callers blocked in a `wait()` call on `ptr`.
pub fn wake(ptr: *const atomic.Value(u32), max_waiters: u32) void {
    // Avoid calling into the OS if there's nothing to wake up.
    if (max_waiters == 0) {
        return;
    }

    Impl.wake(ptr, max_waiters);
}

const Impl = WasmImpl;

const SingleThreadedImpl = struct {
    fn wait(ptr: *const atomic.Value(u32), expect: u32, timeout: ?u64) error{Timeout}!void {
        if (ptr.raw != expect) {
            return;
        }

        // There are no threads to wake us up.
        // So if we wait without a timeout we would never wake up.
        const delay = timeout orelse {
            unreachable; // deadlock detected
        };

        std.time.sleep(delay);
        return error.Timeout;
    }

    fn wake(ptr: *const atomic.Value(u32), max_waiters: u32) void {
        // There are no other threads to possibly wake up
        _ = ptr;
        _ = max_waiters;
    }
};

const WasmImpl = struct {
    fn wait(ptr: *const atomic.Value(u32), expect: u32, timeout: ?u64) error{Timeout}!void {
        if (!comptime std.Target.wasm.featureSetHas(builtin.target.cpu.features, .atomics)) {
            @compileError("WASI target missing cpu feature 'atomics'");
        }
        const to: i64 = if (timeout) |to| @intCast(to) else -1;
        const result = asm volatile (
            \\local.get %[ptr]
            \\local.get %[expected]
            \\local.get %[timeout]
            \\memory.atomic.wait32 0
            \\local.set %[ret]
            : [ret] "=r" (-> u32),
            : [ptr] "r" (&ptr.raw),
              [expected] "r" (@as(i32, @bitCast(expect))),
              [timeout] "r" (to),
        );
        switch (result) {
            0 => {}, // ok
            1 => {}, // expected =! loaded
            2 => return error.Timeout,
            else => unreachable,
        }
    }

    fn wake(ptr: *const atomic.Value(u32), max_waiters: u32) void {
        if (!comptime std.Target.wasm.featureSetHas(builtin.target.cpu.features, .atomics)) {
            @compileError("WASI target missing cpu feature 'atomics'");
        }
        assert(max_waiters != 0);
        const woken_count = asm volatile (
            \\local.get %[ptr]
            \\local.get %[waiters]
            \\memory.atomic.notify 0
            \\local.set %[ret]
            : [ret] "=r" (-> u32),
            : [ptr] "r" (&ptr.raw),
              [waiters] "r" (max_waiters),
        );
        _ = woken_count; // can be 0 when linker flag 'shared-memory' is not enabled
    }
};

pub const Deadline = struct {
    timeout: ?u64,
    started: std.time.Timer,

    pub fn init(expires_in_ns: ?u64) Deadline {
        var deadline: Deadline = undefined;
        deadline.timeout = expires_in_ns;

        // std.time.Timer is required to be supported for somewhat accurate reportings of error.Timeout.
        if (deadline.timeout != null) {
            deadline.started = std.time.Timer.start() catch unreachable;
        }

        return deadline;
    }

    pub fn wait(self: *Deadline, ptr: *const atomic.Value(u32), expect: u32) error{Timeout}!void {
        // Check if we actually have a timeout to wait until.
        // If not just wait "forever".
        const timeout_ns = self.timeout orelse {
            return Futex.wait(ptr, expect);
        };

        // Get how much time has passed since we started waiting
        // then subtract that from the init() timeout to get how much longer to wait.
        // Use overflow to detect when we've been waiting longer than the init() timeout.
        const elapsed_ns = self.started.read();
        const until_timeout_ns = std.math.sub(u64, timeout_ns, elapsed_ns) catch 0;
        return Futex.timedWait(ptr, expect, until_timeout_ns);
    }
};
