const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;
const builtin = @import("builtin");

const LinkedList = @import("../../type/linked-list.zig").LinkedList;

fn RefCount(comptime T: type) type {
    return struct {
        count: std.atomic.Value(usize) = .init(1),

        pub fn inc(self: *@This()) void {
            _ = self.count.fetchAdd(1, .monotonic);
        }

        pub fn dec(self: *@This()) void {
            const prev_count = self.count.fetchSub(1, .monotonic);
            if (prev_count == 1) {
                const parent: *T = @fieldParentPtr("ref", self);
                if (@hasDecl(T, "deinit")) {
                    parent.deinit();
                }
                wasm_allocator.destroy(parent);
            }
        }
    };
}

const Pthread = struct {
    ref: RefCount(@This()) = .{},
    id: pthread_t = undefined,
    wasi_thread_id: u32 = undefined,
    thread: std.Thread = undefined,
    start_routine: *const fn (?*anyopaque) callconv(.c) ?*anyopaque = undefined,
    arg: ?*anyopaque = undefined,
    return_value: ?*anyopaque = null,
    state: std.atomic.Value(State) = .init(.joinable),
    cancel_state: std.atomic.Value(u8) = .init(PTHREAD_CANCEL_ENABLE),
    cancel_type: std.atomic.Value(u8) = .init(PTHREAD_CANCEL_DEFERRED),
    cancel_progress: std.atomic.Value(CancelProgress) = .init(.none),
    cancelled: bool = false,
    attributes: Attributes = .{},

    const Attributes = struct {
        guard_size: usize = 0,
        stack_size: usize = Pthread.def_stack_size,
        detached: u8 = PTHREAD_CREATE_JOINABLE,
        schedule_policy: u8 = SCHED_RR,
        schedule_inheritance: u8 = PTHREAD_INHERIT_SCHED,
        schedule_scope: u8 = PTHREAD_SCOPE_SYSTEM,
        schedule_parameters: struct { priority: u8 = 50 } = .{},
    };
    const State = enum(u8) { joinable, joined, detached };
    const CancelProgress = enum(u8) { none, canceling, canceled };

    const first_id = 1;
    const def_stack_size = 2 * 1024 * 1024;

    var list: LinkedList(*@This()) = .init(wasm_allocator);
    var next_id: std.atomic.Value(pthread_t) = .init(first_id + 1);

    threadlocal var current: ?*@This() = null;

    pub fn deinit(self: *@This()) void {
        _ = list.remove(.eql, self);
    }

    pub fn run(self: *@This()) void {
        // set threadlocal variable so pthread_self() can get itself
        current = self;
        // obtain system thread id (i.e. WASI) for the purpose of cancellation
        self.wasi_thread_id = std.Thread.getCurrentId();
        self.return_value = self.start_routine(self.arg);
        key_value_list.deinit(wasm_allocator);
    }

    pub fn generateId() pthread_t {
        while (true) {
            const id = next_id.fetchAdd(1, .acq_rel);
            if (id > first_id) return id;
        }
    }

    pub fn getCurrent() *@This() {
        return current orelse create: {
            // current thread is not created through pthread
            const self = wasm_allocator.create(@This()) catch @panic("Out of memory");
            self.* = .{};
            const wasi_thread_id = std.Thread.getCurrentId();
            self.wasi_thread_id = wasi_thread_id;
            const WasiThread = @TypeOf(self.thread.impl.thread.*);
            if (wasi_thread_id == 0) {
                // main thread
                self.id = first_id;
                self.state = .init(.detached);
            } else {
                // get the address of the thread from JavaScript
                const address = @"thread-address"(wasi_thread_id);
                const wasi_thread: *WasiThread = @ptrFromInt(address);
                const state = wasi_thread.state.load(.unordered);
                self.id = generateId();
                self.thread.impl.thread = wasi_thread;
                self.state = .init(if (state == .detached) .detached else .joinable);
            }
            current = self;
            list.push(self) catch @panic("Out of memory");
            break :create self;
        };
    }

    pub fn find(id: pthread_t) ?*@This() {
        return list.find(match, id);
    }

    pub fn cancel(self: *@This()) !void {
        const cancel_arg: ?*anyopaque = switch (self.cancel_type.load(.unordered)) {
            PTHREAD_CANCEL_ASYNCHRONOUS => init: {
                // immediate termination is desired; the web worker handling this thread is going
                // to be killed and a replace worker will take its place during thread clean-up
                // we need to provide the necessary information allowing this to happen
                const wasi_thread = self.thread.impl.thread;
                const WasiThread = @TypeOf(wasi_thread.*);
                const Instance = struct {
                    // struct from lib/std/Thread.zig
                    thread: WasiThread,
                    tls_offset: usize,
                    stack_offset: usize,
                    raw_ptr: usize,
                    call_back: *const fn (usize) void,
                    original_stack_pointer: [*]u8,
                };
                const instance: *Instance = @ptrCast(self.thread.impl.thread);
                const bytes = @sizeOf(AsyncCancellation) + 4096; // 4K should be more than enough
                const memory_ptr = wasm_allocator.rawAlloc(bytes, .@"16", 0) orelse return error.OutOfMemory;
                const ac: *AsyncCancellation = @ptrCast(@alignCast(memory_ptr));
                ac.* = .{
                    .memory = memory_ptr[0..bytes],
                    .stack_pointer = memory_ptr + std.mem.alignForward(usize, @sizeOf(AsyncCancellation), 16),
                    .tls_base = wasi_thread.memory.ptr + instance.tls_offset,
                };
                break :init ac;
            },
            else => null,
        };
        // cancellation is handled on the JavaScript side; depending on whether cancel_arg is null,
        // the JS runtime can either immediately axe the worker handling the thread specified
        // by id or wait until it makes a syscall or calls pthread_testcancel()
        @"thread-cancel"(self.wasi_thread_id, cancel_arg);
    }

    pub fn match(self: *const @This(), id: c_ulong) bool {
        return self.id == id;
    }

    pub fn setState(self: *@This(), expected: State, new: State) !void {
        if (self.state.cmpxchgStrong(expected, new, .acq_rel, .monotonic) != null) {
            return error.IncorrectState;
        }
    }

    pub fn performCancellationCleanUp() void {
        // this function runs in a new worker after the one handling the thread was killed
        // since the thread id is reused, we'd have the same TLS variable as before; getCurrent()
        // would still give us the right struct
        var top = PthreadCleanUpCallback.getTop();
        while (top) |ptcb| {
            ptcb.routine(ptcb.arg);
            top = ptcb.next;
        }
        const self = getCurrent();
        self.cancel_progress.store(.canceled, .unordered);
        self.return_value = PTHREAD_CANCELED;
        self.performExitCleanup();
    }

    pub fn performExitCleanup(self: *@This()) void {
        // call destructors inserted by pthread_key_create()
        _ = pthread_spin_lock(&key_list_spinlock);
        defer _ = pthread_spin_unlock(&key_list_spinlock);
        for (key_list.items, 0..) |item, index| {
            if (!item.deleted) {
                if (item.destructor) |destroy| {
                    if (index < key_value_list.items.len) {
                        if (key_value_list.items[index]) |ptr| {
                            destroy(ptr);
                        }
                    }
                }
            }
        }
        key_value_list.deinit(wasm_allocator);
        // termination code copied from WasiThreadImpl
        const wasi_thread = self.thread.impl.thread;
        switch (wasi_thread.state.swap(.completed, .seq_cst)) {
            .running => {
                // reset the Thread ID
                asm volatile (
                    \\ local.get %[ptr]
                    \\ i32.const 0
                    \\ i32.atomic.store 0
                    :
                    : [ptr] "r" (&wasi_thread.tid.raw),
                );

                // Wake the main thread listening to this thread
                asm volatile (
                    \\ local.get %[ptr]
                    \\ i32.const 1 # waiters
                    \\ memory.atomic.notify 0
                    \\ drop # no need to know the waiters
                    :
                    : [ptr] "r" (&wasi_thread.tid.raw),
                );
            },
            .completed => unreachable,
            .detached => {
                // use free in the vtable so the stack doesn't get set to undefined when optimize = Debug
                const free = wasi_thread.allocator.vtable.free;
                const ptr = wasi_thread.allocator.ptr;
                free(ptr, wasi_thread.memory, std.mem.Alignment.@"1", 0);
            },
        }
        // remove from list if it's detached
        if (self.state.load(.unordered) == .detached) {
            self.ref.dec();
        }
    }

    const AsyncCancellation = struct {
        memory: []u8,
        stack_pointer: [*]u8,
        tls_base: [*]u8,
    };

    /// This function is called after a thread has been canceled; if it was a deferred cancelation,
    /// (i.e. the worker interrupted itself voluntarily), the argument would be null; if it was an
    /// async cancelation, the worker has unceremoniously gotten the axe; the pointer provides the
    /// for necessary information for the replacement worker to take on the identity of its
    /// ill-fated comrade and clean up after it
    export fn wasi_thread_clean(_: ?*AsyncCancellation) callconv(.naked) void {
        const clothed = struct {
            // cancel_type is PTHREAD_CANCEL_ASYNCHRONOUS and a new worker has just taken over;
            // our assembly code has recreated the environment of the thread by this point; we
            // just need to perform the clean-up then free the memory allocated for the temporary
            // stack and the AsyncCancellation struct itself
            fn runAsync(ac: *AsyncCancellation) callconv(.c) void {
                // use raw free to avoid modification of stack memory
                defer wasm_allocator.rawFree(ac.memory, .@"16", 0);
                performCancellationCleanUp();
            }

            // cancel_type is PTHREAD_CANCEL_DEFERRED and a cancellation point has just been
            // reached (i.e. a syscall happened); perform clean-up within the original thread
            // using the thread's stack
            fn runDeferred() callconv(.c) void {
                performCancellationCleanUp();
            }
        };
        asm volatile (
            \\ local.get 0
            \\ if
            \\   local.get 0
            \\   i32.load %[stack_pointer]
            \\   global.set __stack_pointer
            \\   local.get 0
            \\   i32.load %[tls_base]
            \\   global.set __tls_base
            \\   local.get 0
            \\   call %[run_async]
            \\ else
            \\   call %[run_deferred]
            \\ end_if
            \\ return
            :
            : [stack_pointer] "X" (@offsetOf(AsyncCancellation, "stack_pointer")),
              [tls_base] "X" (@offsetOf(AsyncCancellation, "tls_base")),
              [run_async] "X" (&clothed.runAsync),
              [run_deferred] "X" (&clothed.runDeferred),
        );
    }

    extern "wasi" fn @"thread-cancel"(id: u32, async_cancel: ?*anyopaque) void;
    extern "wasi" fn @"thread-address"(id: u32) usize;
};

pub fn pthread_create(
    noalias newthread: [*c]pthread_t,
    noalias attr: [*c]const pthread_attr_t,
    start_routine: ?*const fn (?*anyopaque) callconv(.c) ?*anyopaque,
    noalias arg: ?*anyopaque,
) callconv(.c) c_int {
    if (builtin.single_threaded) return errno(.PERM);
    const pthread_attrs: ?*Pthread.Attributes = if (attr) |ptr| @ptrCast(ptr.*) else null;
    const pthread = if (pthread_attrs) |pa| get: {
        const pt: *Pthread = @alignCast(@fieldParentPtr("attributes", pa));
        // increase ref count since we're now using the Pthread struct itself
        pt.ref.inc();
        break :get pt;
    } else alloc: {
        const p = wasm_allocator.create(Pthread) catch return errno(.NOMEM);
        p.* = .{};
        break :alloc p;
    };
    const detach = if (pthread_attrs) |pa| pa.detached == PTHREAD_CREATE_DETACHED else false;
    pthread.id = Pthread.generateId();
    pthread.start_routine = start_routine.?;
    pthread.arg = arg;
    pthread.state = .init(if (detach) .detached else .joinable);
    // create the actual thread through Zig std.Thread
    pthread.thread = std.Thread.spawn(.{
        .allocator = wasm_allocator,
        .stack_size = if (pthread_attrs) |pa| pa.stack_size else Pthread.def_stack_size,
    }, Pthread.run, .{pthread}) catch {
        pthread.ref.dec();
        return errno(.INVAL);
    };
    if (detach) pthread.thread.detach();
    newthread.* = pthread.id;
    Pthread.list.push(pthread) catch {
        pthread.ref.dec();
        return errno(.NOMEM);
    };
    return 0;
}

pub fn pthread_exit(
    retval: ?*anyopaque,
) callconv(.c) noreturn {
    const pthread = Pthread.getCurrent();
    pthread.return_value = retval;
    pthread.performExitCleanup();
    std.os.wasi.proc_exit(0); // trigger a JavaScript error
}

pub fn pthread_join(
    th: pthread_t,
    thread_return: [*c]?*anyopaque,
) callconv(.c) c_int {
    const pthread = Pthread.find(th) orelse return errno(.INVAL);
    pthread.setState(.joinable, .joined) catch return errno(.INVAL);
    pthread.thread.join();
    thread_return.* = pthread.return_value;
    // release a second time to remove it from the list
    pthread.ref.dec();
    return 0;
}

pub fn pthread_detach(
    th: pthread_t,
) callconv(.c) c_int {
    const pthread = Pthread.find(th) orelse return errno(.INVAL);
    pthread.setState(.joinable, .detached) catch return errno(.INVAL);
    pthread.thread.detach();
    return 0;
}

pub fn pthread_self() callconv(.c) pthread_t {
    const pthread = Pthread.getCurrent();
    return pthread.id;
}

pub fn pthread_equal(
    thread1: pthread_t,
    thread2: pthread_t,
) callconv(.c) c_int {
    return if (thread1 == thread2) 1 else 0;
}

pub fn pthread_attr_init(
    attr: [*c]pthread_attr_t,
) callconv(.c) c_int {
    const pthread = wasm_allocator.create(Pthread) catch return errno(.NOMEM);
    pthread.* = .{};
    attr.* = &pthread.attributes;
    return 0;
}

pub fn pthread_attr_destroy(
    attr: [*c]pthread_attr_t,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    const pthread: *Pthread = @alignCast(@fieldParentPtr("attributes", pthread_attrs));
    pthread.ref.dec();
    return 0;
}

pub fn pthread_attr_getdetachstate(
    attr: [*c]const pthread_attr_t,
    detachstate: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    detachstate.* = pthread_attrs.detached;
    return 0;
}

pub fn pthread_attr_setdetachstate(
    attr: [*c]pthread_attr_t,
    detachstate: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.detached = @intCast(detachstate);
    return 0;
}

pub fn pthread_attr_getguardsize(
    attr: [*c]const pthread_attr_t,
    guardsize: [*c]usize,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    guardsize.* = pthread_attrs.guard_size;
    return 0;
}

pub fn pthread_attr_setguardsize(
    attr: [*c]pthread_attr_t,
    guardsize: usize,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.guard_size = guardsize;
    return 0;
}

pub fn pthread_attr_getschedparam(
    noalias attr: [*c]const pthread_attr_t,
    noalias param: [*c]sched_param,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    param.* = .{
        .sched_priority = pthread_attrs.schedule_parameters.priority,
    };
    return 0;
}

pub fn pthread_attr_setschedparam(
    noalias attr: [*c]pthread_attr_t,
    noalias param: [*c]const sched_param,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.schedule_parameters = .{
        .priority = @intCast(param.*.sched_priority),
    };
    return 0;
}

pub fn pthread_attr_getschedpolicy(
    noalias attr: [*c]const pthread_attr_t,
    noalias policy: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    policy.* = pthread_attrs.schedule_policy;
    return 0;
}

pub fn pthread_attr_setschedpolicy(
    attr: [*c]pthread_attr_t,
    policy: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.schedule_policy = @intCast(policy);
    return 0;
}

pub fn pthread_attr_getinheritsched(
    noalias attr: [*c]const pthread_attr_t,
    noalias inherit: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    inherit.* = pthread_attrs.schedule_inheritance;
    return 0;
}

pub fn pthread_attr_setinheritsched(
    attr: [*c]pthread_attr_t,
    inherit: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.schedule_inheritance = @intCast(inherit);
    return 0;
}

pub fn pthread_attr_getscope(
    noalias attr: [*c]const pthread_attr_t,
    noalias scope: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    scope.* = pthread_attrs.schedule_scope;
    return 0;
}

pub fn pthread_attr_setscope(
    attr: [*c]pthread_attr_t,
    scope: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.schedule_scope = @intCast(scope);
    return 0;
}

pub fn pthread_attr_getstackaddr(
    noalias attr: [*c]const pthread_attr_t,
    noalias stackaddr: [*c]?*anyopaque,
) callconv(.c) c_int {
    _ = attr;
    _ = stackaddr;
    return errno(.OPNOTSUPP);
}

pub fn pthread_attr_setstackaddr(
    attr: [*c]pthread_attr_t,
    stackaddr: ?*anyopaque,
) callconv(.c) c_int {
    _ = attr;
    _ = stackaddr;
    return errno(.OPNOTSUPP);
}

pub fn pthread_attr_getstacksize(
    noalias attr: [*c]const pthread_attr_t,
    noalias stacksize: [*c]usize,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    stacksize.* = pthread_attrs.stack_size;
    return 0;
}

pub fn pthread_attr_setstacksize(
    attr: [*c]pthread_attr_t,
    stacksize: usize,
) callconv(.c) c_int {
    const pthread_attrs: *Pthread.Attributes = attr.*;
    pthread_attrs.stack_size = stacksize;
    return 0;
}

pub fn pthread_attr_getstack(
    noalias attr: [*c]const pthread_attr_t,
    noalias stackaddr: [*c]?*anyopaque,
    noalias stacksize: [*c]usize,
) callconv(.c) c_int {
    _ = attr;
    _ = stackaddr;
    _ = stacksize;
    return errno(.OPNOTSUPP);
}

pub fn pthread_attr_setstack(
    attr: [*c]pthread_attr_t,
    stackaddr: ?*anyopaque,
    stacksize: usize,
) callconv(.c) c_int {
    _ = attr;
    _ = stackaddr;
    _ = stacksize;
    return errno(.OPNOTSUPP);
}

pub fn pthread_setschedparam(
    target_thread: pthread_t,
    policy: c_int,
    param: [*c]const sched_param,
) callconv(.c) c_int {
    const pthread = Pthread.find(target_thread) orelse return errno(.INVAL);
    pthread.attributes.schedule_policy = @intCast(policy);
    pthread.attributes.schedule_parameters = .{
        .priority = @intCast(param.*.sched_priority),
    };
    return 0;
}

pub fn pthread_getschedparam(
    target_thread: pthread_t,
    noalias policy: [*c]c_int,
    noalias param: [*c]sched_param,
) callconv(.c) c_int {
    const pthread = Pthread.find(target_thread) orelse return errno(.INVAL);
    policy.* = pthread.attributes.schedule_policy;
    param.* = .{
        .sched_priority = pthread.attributes.schedule_parameters.priority,
    };
    return 0;
}

pub fn pthread_setschedprio(
    target_thread: pthread_t,
    prio: c_int,
) callconv(.c) c_int {
    const pthread = Pthread.find(target_thread) orelse return errno(.INVAL);
    pthread.attributes.schedule_parameters.priority = @intCast(prio);
    return 0;
}

pub fn pthread_once(
    once_control: [*c]pthread_once_t,
    init_routine: ?*const fn () callconv(.c) void,
) callconv(.c) c_int {
    if (@cmpxchgStrong(pthread_once_t, once_control, PTHREAD_ONCE_INIT, PTHREAD_ONCE_INIT + 1, .acq_rel, .monotonic) == null) {
        init_routine.?();
    }
    return 0;
}

pub fn pthread_setcancelstate(
    state: c_int,
    oldstate: [*c]c_int,
) callconv(.c) c_int {
    const pthread = Pthread.getCurrent();
    if (oldstate) |ptr| ptr.* = pthread.cancel_state.load(.unordered);
    pthread.cancel_state.store(@intCast(state), .unordered);
    if (state == PTHREAD_CANCEL_ENABLE) {
        if (pthread.cancel_progress.load(.unordered) == .canceling) {
            pthread.cancel() catch return errno(.NOMEM);
        }
    }
    return 0;
}

pub fn pthread_setcanceltype(
    cantype: c_int,
    oldtype: [*c]c_int,
) callconv(.c) c_int {
    const pthread = Pthread.getCurrent();
    if (oldtype) |ptr| ptr.* = pthread.cancel_type.load(.unordered);
    pthread.cancel_type.store(@intCast(cantype), .unordered);
    return 0;
}

pub fn pthread_cancel(
    th: pthread_t,
) callconv(.c) c_int {
    // can't cancel the main thread
    if (th == 1) return errno(.PERM);
    const pthread = Pthread.find(th) orelse return errno(.SRCH);
    if (pthread.cancel_progress.cmpxchgStrong(.none, .canceling, .monotonic, .monotonic) == null) {
        if (pthread.cancel_state.load(.unordered) == PTHREAD_CANCEL_ENABLE) {
            pthread.cancel() catch return errno(.NOMEM);
        }
    }
    return 0;
}

pub fn pthread_testcancel() callconv(.c) void {
    const pthread = Pthread.getCurrent();
    if (pthread.cancel_progress.load(.unordered) == .canceling) {
        // sched_yield() acts as a cancellation point
        std.Thread.yield() catch {};
    }
}

const PthreadCleanUpCallback = extern struct {
    routine: *const fn (?*anyopaque) callconv(.c) void,
    arg: ?*anyopaque,
    next: ?*@This(),

    threadlocal var top: std.atomic.Value(?*@This()) = .init(null);

    pub fn getTop() ?*@This() {
        return top.load(.acquire);
    }

    pub fn setTop(ptcb: ?*@This()) void {
        top.store(ptcb, .release);
    }
};

pub fn _pthread_cleanup_pop(
    ptcb: [*c]PthreadCleanUpCallback,
    execute: c_int,
) callconv(.c) void {
    PthreadCleanUpCallback.setTop(ptcb.*.next);
    if (execute != 0) {
        ptcb.*.routine(ptcb.*.arg);
    }
}

pub fn _pthread_cleanup_push(
    ptcb: [*c]PthreadCleanUpCallback,
    routine: ?*const fn (?*anyopaque) callconv(.c) void,
    arg: ?*anyopaque,
) callconv(.c) void {
    ptcb.*.routine = @ptrCast(routine);
    ptcb.*.arg = arg;
    ptcb.*.next = null;
    PthreadCleanUpCallback.setTop(ptcb);
}

const PthreadMutex = struct {
    ref: RefCount(@This()) = .{},
    mutex: std.Thread.Mutex = .{},
    lock_count: usize = 0,
    thread_id: std.atomic.Value(pthread_t) = .init(0),
    wait_futex: std.atomic.Value(u32) = .init(0),
    attributes: Attributes = .{},

    const Attributes = struct {
        protocol: c_int = PTHREAD_PRIO_NONE,
        kind: c_int = PTHREAD_MUTEX_NORMAL,
        shared: c_int = PTHREAD_PROCESS_PRIVATE,
        priority_ceiling: c_int = 99,
        robustness: c_int = PTHREAD_MUTEX_STALLED,
    };

    pub fn extract(mutex: [*c]const pthread_mutex_t) *@This() {
        return if (mutex.*) |pm| pm else init_static: {
            const pm = wasm_allocator.create(@This()) catch @panic("Out of memory");
            pm.* = .{};
            const mutable = @constCast(mutex);
            mutable.* = pm;
            break :init_static pm;
        };
    }

    pub fn wait(self: *@This(), duration: u64) void {
        self.wait_futex.store(0, .unordered);
        std.Thread.Futex.timedWait(&self.wait_futex, 0, duration) catch {};
    }

    pub fn wake(self: *@This()) void {
        if (self.wait_futex.load(.unordered) != 0) {
            self.wait_futex.store(1, .unordered);
            std.Thread.Futex.wake(&self.wait_futex, 1);
        }
    }
};

pub fn pthread_mutex_init(
    mutex: [*c]pthread_mutex_t,
    mutexattr: [*c]const pthread_mutexattr_t,
) callconv(.c) c_int {
    const pthread_mutex_attrs: ?*const PthreadMutex.Attributes = if (mutexattr) |ptr| @ptrCast(ptr.*) else null;
    const pthread_mutex: *PthreadMutex = if (pthread_mutex_attrs) |pma| get: {
        const pm: *PthreadMutex = @alignCast(@fieldParentPtr("attributes", @constCast(pma)));
        pm.ref.inc();
        break :get pm;
    } else alloc: {
        const pm = wasm_allocator.create(PthreadMutex) catch return errno(.NOMEM);
        pm.* = .{};
        break :alloc pm;
    };
    mutex.* = pthread_mutex;
    return 0;
}

pub fn pthread_mutex_destroy(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    const pthread_mutex = PthreadMutex.extract(mutex);
    pthread_mutex.ref.dec();
    return 0;
}

pub fn pthread_mutex_trylock(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    const pthread_mutex = PthreadMutex.extract(mutex);
    const current_id = pthread_self();
    switch (pthread_mutex.attributes.kind) {
        PTHREAD_MUTEX_RECURSIVE, PTHREAD_MUTEX_ERRORCHECK => |kind| {
            const owner_id = pthread_mutex.thread_id.load(.unordered);
            if (current_id == owner_id) {
                if (kind == PTHREAD_MUTEX_RECURSIVE) {
                    pthread_mutex.lock_count += 1;
                    return 0;
                } else {
                    return errno(.DEADLK);
                }
            }
        },
        else => {},
    }
    if (!pthread_mutex.mutex.tryLock()) return errno(.BUSY);
    pthread_mutex.thread_id.store(current_id, .unordered);
    pthread_mutex.lock_count = 1;
    return 0;
}

pub fn pthread_mutex_lock(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    const pthread_mutex = PthreadMutex.extract(mutex);
    const current_id = pthread_self();
    switch (pthread_mutex.attributes.kind) {
        PTHREAD_MUTEX_RECURSIVE, PTHREAD_MUTEX_ERRORCHECK => |kind| {
            const owner_id = pthread_mutex.thread_id.load(.unordered);
            if (current_id == owner_id) {
                if (kind == PTHREAD_MUTEX_RECURSIVE) {
                    pthread_mutex.lock_count += 1;
                    return 0;
                } else {
                    return errno(.DEADLK);
                }
            }
        },
        else => {},
    }
    pthread_mutex.mutex.lock();
    pthread_mutex.thread_id.store(current_id, .unordered);
    pthread_mutex.lock_count = 1;
    return 0;
}

pub fn pthread_mutex_timedlock(
    noalias mutex: [*c]pthread_mutex_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    while (true) {
        const result = pthread_mutex_trylock(mutex);
        if (result == errno(.BUSY)) {
            const end = abstime.*;
            const end_ns = end.toTimestamp();
            // get the current time and see if it's large than abstime
            const now = std.posix.clock_gettime(.REALTIME) catch break;
            const now_ns = now.toTimestamp();
            if (now_ns > end_ns) break;
            const pthread_mutex = PthreadMutex.extract(mutex);
            pthread_mutex.wait(end_ns - now_ns);
        } else return result;
    }
    return errno(.TIMEDOUT);
}

pub fn pthread_mutex_unlock(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    const pthread_mutex = PthreadMutex.extract(mutex);
    const current_id = pthread_self();
    switch (pthread_mutex.attributes.kind) {
        PTHREAD_MUTEX_RECURSIVE, PTHREAD_MUTEX_ERRORCHECK => |kind| {
            const owner_id = pthread_mutex.thread_id.load(.unordered);
            if (current_id == owner_id) {
                if (kind == PTHREAD_MUTEX_RECURSIVE) {
                    pthread_mutex.lock_count -= 1;
                    if (pthread_mutex.lock_count > 0) return 0;
                }
            } else {
                if (kind == PTHREAD_MUTEX_ERRORCHECK) {
                    return errno(.INVAL); // not the owner
                }
            }
        },
        else => {},
    }
    pthread_mutex.mutex.unlock();
    pthread_mutex.lock_count = 0;
    pthread_mutex.thread_id.store(0, .unordered);
    pthread_mutex.wake();
    return 0;
}

pub fn pthread_mutex_getprioceiling(
    noalias mutex: [*c]const pthread_mutex_t,
    noalias prioceiling: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex = PthreadMutex.extract(mutex);
    prioceiling.* = pthread_mutex.attributes.priority_ceiling;
    return 0;
}

pub fn pthread_mutex_setprioceiling(
    noalias mutex: [*c]pthread_mutex_t,
    prioceiling: c_int,
    noalias old_ceiling: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex = PthreadMutex.extract(mutex);
    old_ceiling.* = pthread_mutex.attributes.priority_ceiling;
    pthread_mutex.attributes.priority_ceiling = prioceiling;
    return 0;
}

pub fn pthread_mutex_consistent(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    _ = mutex;
    return errno(.INVAL);
}

pub fn pthread_mutexattr_init(
    attr: [*c]pthread_mutexattr_t,
) callconv(.c) c_int {
    const pthread_mutex = wasm_allocator.create(PthreadMutex) catch return errno(.NOMEM);
    pthread_mutex.* = .{};
    attr.* = &pthread_mutex.attributes;
    return 0;
}

pub fn pthread_mutexattr_destroy(
    attr: [*c]pthread_mutexattr_t,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    const pthread_mutex: *PthreadMutex = @alignCast(@fieldParentPtr("attributes", pthread_mutex_attrs));
    pthread_mutex.ref.dec();
    return 0;
}

pub fn pthread_mutexattr_getpshared(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    pshared.* = pthread_mutex_attrs.shared;
    return 0;
}

pub fn pthread_mutexattr_setpshared(
    attr: [*c]pthread_mutexattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    pthread_mutex_attrs.shared = pshared;
    return 0;
}

pub fn pthread_mutexattr_gettype(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias kind: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    kind.* = pthread_mutex_attrs.kind;
    return 0;
}

pub fn pthread_mutexattr_settype(
    attr: [*c]pthread_mutexattr_t,
    kind: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    pthread_mutex_attrs.kind = kind;
    return 0;
}

pub fn pthread_mutexattr_getprotocol(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias protocol: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    protocol.* = pthread_mutex_attrs.protocol;
    return 0;
}

pub fn pthread_mutexattr_setprotocol(
    attr: [*c]pthread_mutexattr_t,
    protocol: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    pthread_mutex_attrs.protocol = protocol;
    return 0;
}

pub fn pthread_mutexattr_getprioceiling(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias prioceiling: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    prioceiling.* = pthread_mutex_attrs.priority_ceiling;
    return 0;
}

pub fn pthread_mutexattr_setprioceiling(
    attr: [*c]pthread_mutexattr_t,
    prioceiling: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    pthread_mutex_attrs.priority_ceiling = prioceiling;
    return 0;
}

pub fn pthread_mutexattr_getrobust(
    attr: [*c]const pthread_mutexattr_t,
    robustness: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    robustness.* = pthread_mutex_attrs.robustness;
    return 0;
}

pub fn pthread_mutexattr_setrobust(
    attr: [*c]pthread_mutexattr_t,
    robustness: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutex.Attributes = attr.*;
    pthread_mutex_attrs.robustness = robustness;
    return 0;
}

const PthreadRwLock = struct {
    ref: RefCount(@This()) = .{},
    lock: std.Thread.RwLock = .{},
    writer_thread_id: pthread_t = 0,
    reader_thread_list: std.ArrayListUnmanaged(pthread_t) = .{},
    reader_thread_list_spinlock: pthread_spinlock_t = 0,
    wait_futex: std.atomic.Value(u32) = .init(0),
    attributes: Attributes = .{},

    const Attributes = struct {
        kind: u8 = PTHREAD_MUTEX_NORMAL,
        shared: u8 = PTHREAD_PROCESS_PRIVATE,
    };

    pub fn extract(rwlock: [*c]const pthread_rwlock_t) *@This() {
        return if (rwlock.*) |prw| prw else init_static: {
            const prw = wasm_allocator.create(@This()) catch @panic("Out of memory");
            prw.* = .{};
            const mutable = @constCast(rwlock);
            mutable.* = prw;
            break :init_static prw;
        };
    }

    pub fn wait(self: *@This(), duration: u64) void {
        self.wait_futex.store(0, .unordered);
        std.Thread.Futex.timedWait(&self.wait_futex, 0, duration) catch {};
    }

    pub fn wake(self: *@This()) void {
        if (self.wait_futex.load(.unordered) != 0) {
            self.wait_futex.store(1, .unordered);
            std.Thread.Futex.wake(&self.wait_futex, 1);
        }
    }
};

pub fn pthread_rwlock_init(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias attr: [*c]const pthread_rwlockattr_t,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: ?*const PthreadRwLock.Attributes = if (attr) |ptr| @ptrCast(ptr.*) else null;
    const pthread_rwlock: *PthreadRwLock = if (pthread_rwlock_attrs) |prwa| get: {
        const prw: *PthreadRwLock = @alignCast(@fieldParentPtr("attributes", @constCast(prwa)));
        prw.ref.inc();
        break :get prw;
    } else alloc: {
        const prw = wasm_allocator.create(PthreadRwLock) catch return errno(.NOMEM);
        prw.* = .{};
        break :alloc prw;
    };
    rwlock.* = pthread_rwlock;
    return 0;
}

pub fn pthread_rwlock_destroy(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    pthread_rwlock.ref.dec();
    return 0;
}

pub fn pthread_rwlock_rdlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    pthread_rwlock.lock.lockShared();
    const thread_id = pthread_self();
    _ = pthread_spin_lock(&pthread_rwlock.reader_thread_list_spinlock);
    defer _ = pthread_spin_unlock(&pthread_rwlock.reader_thread_list_spinlock);
    pthread_rwlock.reader_thread_list.append(wasm_allocator, thread_id) catch {
        pthread_rwlock.lock.unlockShared();
        return errno(.NOMEM);
    };
    return 0;
}

pub fn pthread_rwlock_tryrdlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    if (!pthread_rwlock.lock.tryLockShared()) return errno(.BUSY);
    const thread_id = pthread_self();
    _ = pthread_spin_lock(&pthread_rwlock.reader_thread_list_spinlock);
    defer _ = pthread_spin_unlock(&pthread_rwlock.reader_thread_list_spinlock);
    pthread_rwlock.reader_thread_list.append(wasm_allocator, thread_id) catch {
        pthread_rwlock.lock.unlockShared();
        return errno(.NOMEM);
    };
    return 0;
}

pub fn pthread_rwlock_timedrdlock(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    while (true) {
        const result = pthread_rwlock_tryrdlock(rwlock);
        if (result == errno(.BUSY)) {
            const pthread_rwlock = PthreadRwLock.extract(rwlock);
            const end = abstime.*;
            const end_ns = end.toTimestamp();
            const now = std.posix.clock_gettime(.REALTIME) catch break;
            const now_ns = now.toTimestamp();
            if (now_ns >= end_ns) break;
            const duration = end_ns - now_ns;
            pthread_rwlock.wait(duration);
        } else return result;
    }
    return errno(.TIMEDOUT);
}

pub fn pthread_rwlock_wrlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    pthread_rwlock.lock.lock();
    pthread_rwlock.writer_thread_id = pthread_self();
    return 0;
}

pub fn pthread_rwlock_trywrlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    if (!pthread_rwlock.lock.tryLock()) return errno(.BUSY);
    pthread_rwlock.writer_thread_id = pthread_self();
    return 0;
}

pub fn pthread_rwlock_timedwrlock(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    while (true) {
        const result = pthread_rwlock_trywrlock(rwlock);
        if (result == errno(.BUSY)) {
            const pthread_rwlock = PthreadRwLock.extract(rwlock);
            const end = abstime.*;
            const end_ns = end.toTimestamp();
            const now = std.posix.clock_gettime(.REALTIME) catch break;
            const now_ns = now.toTimestamp();
            if (now_ns >= end_ns) break;
            const duration = end_ns - now_ns;
            pthread_rwlock.wait(duration);
        } else return result;
    }
    return errno(.TIMEDOUT);
}

pub fn pthread_rwlock_unlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    const thread_id = pthread_self();
    if (pthread_rwlock.writer_thread_id != 0) {
        if (thread_id != pthread_rwlock.writer_thread_id) return errno(.PERM);
        pthread_rwlock.writer_thread_id = 0;
        pthread_rwlock.lock.unlock();
    } else {
        var reader_index: usize = undefined;
        for (pthread_rwlock.reader_thread_list.items, 0..) |id, index| {
            if (thread_id == id) {
                reader_index = index;
                break;
            }
        } else return errno(.PERM);
        pthread_rwlock.lock.unlockShared();
        _ = pthread_spin_lock(&pthread_rwlock.reader_thread_list_spinlock);
        defer _ = pthread_spin_unlock(&pthread_rwlock.reader_thread_list_spinlock);
        _ = pthread_rwlock.reader_thread_list.swapRemove(reader_index);
    }
    pthread_rwlock.wake();
    return 0;
}

pub fn pthread_rwlockattr_init(
    attr: [*c]pthread_rwlockattr_t,
) callconv(.c) c_int {
    const pthread_rwlock = wasm_allocator.create(PthreadRwLock) catch return errno(.NOMEM);
    pthread_rwlock.* = .{};
    attr.* = &pthread_rwlock.attributes;
    return 0;
}

pub fn pthread_rwlockattr_destroy(
    attr: [*c]pthread_rwlockattr_t,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLock.Attributes = attr.*;
    const pthread_rwlock: *PthreadRwLock = @alignCast(@fieldParentPtr("attributes", pthread_rwlock_attrs));
    pthread_rwlock.ref.dec();
    return 0;
}

pub fn pthread_rwlockattr_getpshared(
    noalias attr: [*c]const pthread_rwlockattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLock.Attributes = attr.*;
    pshared.* = pthread_rwlock_attrs.shared;
    return 0;
}

pub fn pthread_rwlockattr_setpshared(
    attr: [*c]pthread_rwlockattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLock.Attributes = attr.*;
    pthread_rwlock_attrs.shared = @intCast(pshared);
    return 0;
}

pub fn pthread_rwlockattr_getkind_np(
    noalias attr: [*c]const pthread_rwlockattr_t,
    noalias pref: [*c]c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLock.Attributes = attr.*;
    pref.* = pthread_rwlock_attrs.kind;
    return 0;
}

pub fn pthread_rwlockattr_setkind_np(
    attr: [*c]pthread_rwlockattr_t,
    pref: c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLock.Attributes = attr.*;
    pthread_rwlock_attrs.kind = @intCast(pref);
    return 0;
}

const PthreadCondition = struct {
    ref: RefCount(@This()) = .{},
    condition: std.Thread.Condition = .{},
    attributes: PthreadCondition.Attributes = .{},

    const Attributes = struct {
        shared: c_int = PTHREAD_PROCESS_PRIVATE,
        clock_id: std.posix.clockid_t = .REALTIME,
    };

    pub fn extract(cond: [*c]const pthread_cond_t) *@This() {
        return if (cond.*) |pc| pc else init_static: {
            const pc = wasm_allocator.create(@This()) catch @panic("Out of memory");
            pc.* = .{};
            const mutable = @constCast(cond);
            mutable.* = pc;
            break :init_static pc;
        };
    }
};

pub fn pthread_cond_init(
    noalias cond: [*c]pthread_cond_t,
    noalias attr: [*c]const pthread_condattr_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: ?*const PthreadCondition.Attributes = if (attr) |ptr| @ptrCast(ptr.*) else null;
    const pthread_condition: *PthreadCondition = if (pthread_condition_attrs) |pca| get: {
        const pc: *PthreadCondition = @alignCast(@fieldParentPtr("attributes", @constCast(pca)));
        pc.ref.inc();
        break :get pc;
    } else alloc: {
        const pc = wasm_allocator.create(PthreadCondition) catch return errno(.NOMEM);
        pc.* = .{};
        break :alloc pc;
    };
    cond.* = pthread_condition;
    return 0;
}

pub fn pthread_cond_destroy(
    cond: [*c]pthread_cond_t,
) callconv(.c) c_int {
    const pthread_condition = PthreadCondition.extract(cond);
    pthread_condition.ref.dec();
    return 0;
}

pub fn pthread_cond_signal(
    cond: [*c]pthread_cond_t,
) callconv(.c) c_int {
    const pthread_condition = PthreadCondition.extract(cond);
    pthread_condition.condition.signal();
    return 0;
}

pub fn pthread_cond_broadcast(
    cond: [*c]pthread_cond_t,
) callconv(.c) c_int {
    const pthread_condition = PthreadCondition.extract(cond);
    pthread_condition.condition.broadcast();
    return 0;
}

pub fn pthread_cond_wait(
    noalias cond: [*c]pthread_cond_t,
    noalias mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    const pthread_condition = PthreadCondition.extract(cond);
    const pthread_mutex: *PthreadMutex = @ptrCast(mutex.*);
    pthread_condition.condition.wait(&pthread_mutex.mutex);
    return 0;
}

pub fn pthread_cond_timedwait(
    noalias cond: [*c]pthread_cond_t,
    noalias mutex: [*c]pthread_mutex_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    const pthread_condition = PthreadCondition.extract(cond);
    const pthread_mutex: *PthreadMutex = @ptrCast(mutex.*);
    const end = abstime.*;
    const end_ns = end.toTimestamp();
    const clock_id = pthread_condition.attributes.clock_id;
    const now = std.posix.clock_gettime(clock_id) catch return errno(.TIMEDOUT);
    const now_ns = now.toTimestamp();
    if (now_ns >= end_ns) return errno(.TIMEDOUT);
    const duration = end_ns - now_ns;
    pthread_condition.condition.timedWait(&pthread_mutex.mutex, duration) catch return errno(.TIMEDOUT);
    return 0;
}

pub fn pthread_condattr_init(
    attr: [*c]pthread_condattr_t,
) callconv(.c) c_int {
    const pthread_condition = wasm_allocator.create(PthreadCondition) catch return errno(.NOMEM);
    pthread_condition.* = .{};
    attr.* = &pthread_condition.attributes;
    return 0;
}

pub fn pthread_condattr_destroy(
    attr: [*c]pthread_condattr_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadCondition.Attributes = attr.*;
    const pthread_condition: *PthreadCondition = @alignCast(@fieldParentPtr("attributes", pthread_condition_attrs));
    pthread_condition.ref.dec();
    return 0;
}

pub fn pthread_condattr_getpshared(
    noalias attr: [*c]const pthread_condattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadCondition.Attributes = attr.*;
    pshared.* = pthread_condition_attrs.shared;
    return 0;
}

pub fn pthread_condattr_setpshared(
    attr: [*c]pthread_condattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadCondition.Attributes = attr.*;
    pthread_condition_attrs.shared = pshared;
    return 0;
}

pub fn pthread_condattr_getclock(
    noalias attr: [*c]const pthread_condattr_t,
    noalias clock_id: [*c]std.posix.clockid_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadCondition.Attributes = attr.*;
    clock_id.* = pthread_condition_attrs.clock_id;
    return 0;
}

pub fn pthread_condattr_setclock(
    attr: [*c]pthread_condattr_t,
    clock_id: std.posix.clockid_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadCondition.Attributes = attr.*;
    pthread_condition_attrs.clock_id = clock_id;
    return 0;
}

pub fn pthread_spin_init(
    lock: [*c]volatile pthread_spinlock_t,
    pshared: c_int,
) callconv(.c) c_int {
    _ = pshared;
    lock.* = 0;
    return 0;
}

pub fn pthread_spin_destroy(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    _ = lock;
    return 0;
}

pub fn pthread_spin_lock(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    const thread_id = pthread_self();
    const lock_value: pthread_spinlock_t = @bitCast(thread_id);
    while (true) {
        if (@cmpxchgWeak(pthread_spinlock_t, lock, 0, lock_value, .acq_rel, .monotonic) == null) {
            break;
        }
    }
    return 0;
}

pub fn pthread_spin_trylock(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    const thread_id = pthread_self();
    const lock_value: pthread_spinlock_t = @bitCast(thread_id);
    if (@cmpxchgWeak(pthread_spinlock_t, lock, 0, lock_value, .acq_rel, .monotonic) != null) {
        return errno(.BUSY);
    }
    return 0;
}

pub fn pthread_spin_unlock(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    const thread_id = pthread_self();
    const lock_value: pthread_spinlock_t = @bitCast(thread_id);
    if (@cmpxchgWeak(pthread_spinlock_t, lock, lock_value, 0, .acq_rel, .monotonic) != null) {
        return errno(.PERM);
    }
    return 0;
}

var key_list: std.ArrayListUnmanaged(struct {
    destructor: ?*const fn (?*anyopaque) callconv(.c) void = null,
    deleted: bool = false,
}) = .{};
var key_list_spinlock: pthread_spinlock_t = 0;
threadlocal var key_value_list: std.ArrayListUnmanaged(?*anyopaque) = .{};

pub fn pthread_key_create(
    key: [*c]pthread_key_t,
    destr_function: ?*const fn (?*anyopaque) callconv(.c) void,
) callconv(.c) c_int {
    _ = pthread_spin_lock(&key_list_spinlock);
    defer _ = pthread_spin_unlock(&key_list_spinlock);
    key_list.append(wasm_allocator, .{ .destructor = destr_function }) catch return errno(.NOMEM);
    key.* = @intCast(key_list.items.len);
    return 0;
}

pub fn pthread_key_delete(
    key: pthread_key_t,
) callconv(.c) c_int {
    _ = pthread_spin_lock(&key_list_spinlock);
    defer _ = pthread_spin_unlock(&key_list_spinlock);
    const index: usize = @intCast(key);
    if (index >= key_list.items.len) return errno(.INVAL);
    const item = &key_list.items[index];
    if (item.deleted) return errno(.INVAL);
    item.deleted = true;
    return 0;
}

pub fn pthread_getspecific(
    key: pthread_key_t,
) callconv(.c) ?*anyopaque {
    if (key == 0) return null;
    const index: usize = @intCast(key - 1);
    if (index >= key_value_list.items.len) return null;
    return key_value_list.items[index];
}

pub fn pthread_setspecific(
    key: pthread_key_t,
    pointer: ?*anyopaque,
) callconv(.c) c_int {
    if (key == 0) return errno(.INVAL);
    const index: usize = @intCast(key - 1);
    if (index >= key_list.items.len) return errno(.INVAL);
    if (index >= key_value_list.items.len) {
        const start = key_value_list.items.len;
        key_value_list.resize(wasm_allocator, index + 1) catch return errno(.NOMEM);
        for (key_value_list.items[start .. index + 1]) |*ptr| ptr.* = null;
    }
    key_value_list.items[index] = pointer;
    return 0;
}

pub fn pthread_getcpuclockid(
    thread_id: pthread_t,
    clock_id: [*c]std.posix.clockid_t,
) callconv(.c) c_int {
    _ = thread_id;
    _ = clock_id;
    return errno(.NOENT);
}

const PthreadSemaphore = struct {
    ref: RefCount(@This()) = .{},
    semaphore: std.Thread.Semaphore = .{},
    attributes: Attributes = .{},
    name: ?[]u8 = null,

    const Attributes = struct {
        shared: c_int = PTHREAD_PROCESS_PRIVATE,
    };

    var list: LinkedList(*@This()) = .init(wasm_allocator);

    pub fn deinit(self: *@This()) void {
        if (self.name) |n| wasm_allocator.free(n);
    }

    pub fn extract(sem: [*c]const sem_t) *@This() {
        return if (sem.*) |prw| @constCast(prw) else unreachable;
    }

    pub fn match(ptr: *@This(), name: []const u8) bool {
        return std.mem.eql(u8, ptr.name.?, name);
    }
};

pub fn sem_init(
    sem: [*c]sem_t,
    pshared: c_int,
    value: c_uint,
) callconv(.c) c_int {
    const pthread_semaphore = wasm_allocator.create(PthreadSemaphore) catch {
        return semErrno(.NOMEM, -1);
    };
    pthread_semaphore.* = .{
        .semaphore = .{
            .permits = @intCast(value),
        },
        .attributes = .{ .shared = pshared },
    };
    sem.* = pthread_semaphore;
    return 0;
}

pub fn sem_destroy(
    sem: [*c]sem_t,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    pthread_semaphore.ref.dec();
    return 0;
}

pub fn sem_open(
    name: [*c]const u8,
    oflag: c_int,
    ...,
) callconv(.c) [*c]sem_t {
    const flags: std.c.O = @bitCast(oflag);
    const name_s = name[0..std.mem.len(name)];
    const ps_ptr = if (PthreadSemaphore.list.findReturnPtr(PthreadSemaphore.match, name_s)) |ptr| use: {
        if (flags.CREAT and flags.EXCL) return semErrno(.EXIST, SEM_FAILED);
        break :use ptr;
    } else create: {
        if (!flags.CREAT) return semErrno(.NOENT, SEM_FAILED);
        var va_list = @cVaStart();
        defer @cVaEnd(&va_list);
        _ = @cVaArg(&va_list, std.c.mode_t);
        const value = @cVaArg(&va_list, c_uint);
        const ps = wasm_allocator.create(PthreadSemaphore) catch {
            return semErrno(.NOMEM, SEM_FAILED);
        };
        const name_dupe = wasm_allocator.dupe(u8, name_s) catch {
            wasm_allocator.destroy(ps);
            return semErrno(.NOMEM, SEM_FAILED);
        };
        ps.* = .{
            .semaphore = .{
                .permits = @intCast(value),
            },
            .attributes = .{ .shared = PTHREAD_PROCESS_SHARED },
            .name = name_dupe,
        };
        break :create PthreadSemaphore.list.pushReturnPtr(ps) catch {
            ps.ref.dec();
            return semErrno(.NOMEM, SEM_FAILED);
        };
    };
    // newly created semaphore will have ref_count = 2, such that a call to sem_close()
    // wouldn't cause its deallocation
    const pthread_semaphore = ps_ptr.*;
    pthread_semaphore.ref.inc();
    return @ptrCast(@constCast(ps_ptr));
}

pub fn sem_close(
    sem: [*c]sem_t,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    if (pthread_semaphore.name == null) return semErrno(.INVAL, -1);
    pthread_semaphore.ref.dec();
    return 0;
}

pub fn sem_unlink(
    name: [*c]const u8,
) callconv(.c) c_int {
    const name_s = name[0..std.mem.len(name)];
    const pthread_semaphore = PthreadSemaphore.list.remove(PthreadSemaphore.match, name_s) orelse {
        return semErrno(.NOENT, -1);
    };
    pthread_semaphore.ref.dec();
    pthread_semaphore.ref.dec(); // extra dec to deallocate it
    return 0;
}

pub fn sem_wait(
    sem: [*c]sem_t,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    pthread_semaphore.semaphore.wait();
    return 0;
}

pub fn sem_timedwait(
    noalias sem: [*c]sem_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    const end = abstime.*;
    const end_ns = end.toTimestamp();
    const now = std.posix.clock_gettime(.REALTIME) catch return semErrno(.TIMEDOUT, -1);
    const now_ns = now.toTimestamp();
    if (now_ns >= end_ns) return semErrno(.TIMEDOUT, -1);
    const duration = end_ns - now_ns;
    pthread_semaphore.semaphore.timedWait(duration) catch return semErrno(.TIMEDOUT, -1);
    return 0;
}

pub fn sem_trywait(
    sem: [*c]sem_t,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    pthread_semaphore.semaphore.timedWait(0) catch return semErrno(.AGAIN, -1);
    return 0;
}

pub fn sem_post(
    sem: [*c]sem_t,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    pthread_semaphore.semaphore.post();
    return 0;
}

pub fn sem_getvalue(
    noalias sem: [*c]sem_t,
    noalias sval: [*c]c_int,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    sval.* = @intCast(pthread_semaphore.semaphore.permits);
    return 0;
}

const sched_param = extern struct {
    sched_priority: c_int,
};
const pthread_t = c_ulong;
const pthread_attr_t = *Pthread.Attributes;
const pthread_mutexattr_t = *PthreadMutex.Attributes;
const pthread_mutex_t = ?*PthreadMutex;
const pthread_condattr_t = *PthreadCondition.Attributes;
const pthread_cond_t = ?*PthreadCondition;
const pthread_rwlockattr_t = *PthreadRwLock.Attributes;
const pthread_rwlock_t = ?*PthreadRwLock;
const pthread_key_t = c_uint;
const pthread_once_t = c_int;
const pthread_spinlock_t = c_int;
const sem_t = ?*PthreadSemaphore;

const SCHED_RR = 2;
const PTHREAD_INHERIT_SCHED = 0;
const PTHREAD_SCOPE_SYSTEM = 0;
const PTHREAD_CREATE_JOINABLE = 0;
const PTHREAD_CREATE_DETACHED = 1;
const PTHREAD_MUTEX_NORMAL = 0;
const PTHREAD_MUTEX_RECURSIVE = 1;
const PTHREAD_MUTEX_ERRORCHECK = 2;
const PTHREAD_PROCESS_PRIVATE = 0;
const PTHREAD_PROCESS_SHARED = 1;
const PTHREAD_MUTEX_STALLED = 0;
const PTHREAD_PRIO_NONE = 0;
const PTHREAD_ONCE_INIT = 0;
const PTHREAD_CANCEL_ENABLE = 0;
const PTHREAD_CANCEL_DISABLE = 1;
const PTHREAD_CANCEL_MASKED = 2;
const PTHREAD_CANCEL_DEFERRED = 0;
const PTHREAD_CANCEL_ASYNCHRONOUS = 1;
const PTHREAD_CANCELED: *anyopaque = @ptrFromInt(std.math.maxInt(usize));
const SEM_FAILED: [*c]sem_t = @ptrFromInt(0);

fn errno(e: std.posix.E) u16 {
    return @intFromEnum(e);
}

fn semErrno(e: std.posix.E, retval: anytype) rv_type: {
    const T = @TypeOf(retval);
    break :rv_type if (T == comptime_int) c_int else T;
} {
    std.c._errno().* = @intFromEnum(e);
    return retval;
}
