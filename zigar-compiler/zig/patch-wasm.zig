const std = @import("std");
const builtin = @import("builtin");
const atomic = std.atomic;

pub const Futex = struct {
    pub const Deadline = std.Thread.Futex.Deadline;

    pub fn wait(ptr: *const atomic.Value(u32), expect: u32) void {
        @setCold(true);

        Impl.wait(ptr, expect, null) catch |err| switch (err) {
            error.Timeout => unreachable, // null timeout meant to wait forever
        };
    }

    pub fn timedWait(ptr: *const atomic.Value(u32), expect: u32, timeout_ns: u64) error{Timeout}!void {
        @setCold(true);

        // Avoid calling into the OS for no-op timeouts.
        if (timeout_ns == 0) {
            if (ptr.load(.seq_cst) != expect) return;
            return error.Timeout;
        }

        return Impl.wait(ptr, expect, timeout_ns);
    }

    pub fn wake(ptr: *const atomic.Value(u32), max_waiters: u32) void {
        @setCold(true);

        // Avoid calling into the OS if there's nothing to wake up.
        if (max_waiters == 0) {
            return;
        }

        Impl.wake(ptr, max_waiters);
    }
};

const Impl = struct {
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
