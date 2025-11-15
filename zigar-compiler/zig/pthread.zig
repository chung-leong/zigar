const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;

const LinkedList = @import("type/linked-list.zig").LinkedList;

const Pthread = struct {
    id: pthread_t = undefined,
    thread: std.Thread = undefined,
    start_routine: *const fn (?*anyopaque) callconv(.c) ?*anyopaque = undefined,
    arg: ?*anyopaque = undefined,
    return_value: ?*anyopaque = null,
    state: PthreadState = .joinable,
    attributes: PthreadAttributes = .{},

    const first_id = 1;
    const def_stack_size = 2 * 1024 * 1024;

    var list: LinkedList(@This()) = .init(wasm_allocator);
    var next_id: std.atomic.Value(pthread_t) = .init(first_id + 1);

    threadlocal var current: ?*@This() = null;

    fn alloc() !*@This() {
        return try list.push(.{});
    }

    fn allocId() pthread_t {
        while (true) {
            const id = next_id.fetchAdd(1, .acq_rel);
            if (id > first_id) return id;
        }
    }

    fn find(id: pthread_t) ?*@This() {
        return list.find(match, id);
    }

    fn addRef(self: *@This()) void {
        list.addRef(self);
    }

    fn release(self: *@This()) void {
        list.release(self);
    }

    fn match(self: *const @This(), id: c_ulong) bool {
        return self.id == id;
    }

    fn setState(self: *@This(), expected: PthreadState, new: PthreadState) !void {
        if (@cmpxchgStrong(PthreadState, &self.state, expected, new, .acq_rel, .monotonic) != null) {
            return error.IncorrectState;
        }
    }
};
const PthreadAttributes = struct {
    detached: c_int = PTHREAD_CREATE_JOINABLE,
    guard_size: usize = 0,
    stack_size: usize = Pthread.def_stack_size,
    schedule_parameters: sched_param = .{ .sched_priority = 50 },
    schedule_policy: c_int = SCHED_RR,
    schedule_inheritance: c_int = PTHREAD_INHERIT_SCHED,
    schedule_scope: c_int = PTHREAD_SCOPE_SYSTEM,
};
const PthreadState = enum { joinable, joined, detached };

pub fn pthread_create(
    noalias newthread: [*c]pthread_t,
    noalias attr: [*c]const pthread_attr_t,
    start_routine: ?*const fn (?*anyopaque) callconv(.c) ?*anyopaque,
    noalias arg: ?*anyopaque,
) callconv(.c) c_int {
    const pthread_attrs: ?*PthreadAttributes = if (attr) |ptr| @ptrCast(ptr.*) else null;
    const pthread = if (pthread_attrs) |pa| get: {
        const pt: *Pthread = @fieldParentPtr("attributes", pa);
        // increase ref count since we're now using the Pthread struct itself
        pt.addRef();
        break :get pt;
    } else Pthread.alloc() catch return errno(.NOMEM);
    errdefer pthread.release();
    const detach = if (pthread_attrs) |pa| pa.detached == PTHREAD_CREATE_DETACHED else false;
    pthread.id = Pthread.allocId();
    pthread.start_routine = start_routine.?;
    pthread.arg = arg;
    pthread.state = if (detach) .detached else .joinable;
    // create the actual thread through Zig std
    pthread.thread = std.Thread.spawn(.{
        .allocator = wasm_allocator,
        .stack_size = if (pthread_attrs) |pa| pa.stack_size else Pthread.def_stack_size,
    }, run_pthread, .{pthread}) catch return errno(.INVAL);
    if (detach) pthread.thread.detach();
    newthread.* = pthread.id;
    return 0;
}

fn run_pthread(thread: *Pthread) void {
    // set threadlocal variable so pthread_self() can get itself
    Pthread.current = thread;
    thread.return_value = thread.start_routine(thread.arg);
    Pthread.current = null;
}

pub fn pthread_exit(
    retval: ?*anyopaque,
) callconv(.c) noreturn {
    if (Pthread.current) |pthread| {
        pthread.return_value = retval;
        // termination code copied from WasiThreadImpl
        const wasi_thread = pthread.thread.impl.thread;
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
    }
    // trigger a JavaScript error
    std.os.wasi.proc_exit(0);
}

pub fn pthread_join(
    th: pthread_t,
    thread_return: [*c]?*anyopaque,
) callconv(.c) c_int {
    const pthread = Pthread.find(th) orelse return errno(.INVAL);
    defer pthread.release();
    pthread.setState(.joinable, .joined) catch return errno(.INVAL);
    pthread.thread.join();
    thread_return.* = pthread.return_value;
    return 0;
}

pub fn pthread_detach(
    th: pthread_t,
) callconv(.c) c_int {
    const pthread = Pthread.find(th) orelse return errno(.INVAL);
    defer pthread.release();
    pthread.setState(.joinable, .detached) catch return errno(.INVAL);
    pthread.thread.detach();
    return 0;
}

pub fn pthread_self() callconv(.c) pthread_t {
    return if (Pthread.current) |pthread| pthread.id else Pthread.first_id;
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
    const pthread = Pthread.alloc() catch return errno(.NOMEM);
    attr.* = &pthread.attributes;
    return 0;
}

pub fn pthread_attr_destroy(
    attr: [*c]pthread_attr_t,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    const pthread: *Pthread = @fieldParentPtr("attributes", pthread_attrs);
    pthread.release();
    return 0;
}

pub fn pthread_attr_getdetachstate(
    attr: [*c]const pthread_attr_t,
    detachstate: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    detachstate.* = pthread_attrs.detached;
    return 0;
}

pub fn pthread_attr_setdetachstate(
    attr: [*c]pthread_attr_t,
    detachstate: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    pthread_attrs.detached = detachstate;
    return 0;
}

pub fn pthread_attr_getguardsize(
    attr: [*c]const pthread_attr_t,
    guardsize: [*c]usize,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    guardsize.* = pthread_attrs.guard_size;
    return 0;
}

pub fn pthread_attr_setguardsize(
    attr: [*c]pthread_attr_t,
    guardsize: usize,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    pthread_attrs.guard_size = guardsize;
    return 0;
}

pub fn pthread_attr_getschedparam(
    noalias attr: [*c]const pthread_attr_t,
    noalias param: [*c]sched_param,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    param.* = pthread_attrs.schedule_parameters;
    return 0;
}

pub fn pthread_attr_setschedparam(
    noalias attr: [*c]pthread_attr_t,
    noalias param: [*c]const sched_param,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    pthread_attrs.schedule_parameters = param.*;
    return 0;
}

pub fn pthread_attr_getschedpolicy(
    noalias attr: [*c]const pthread_attr_t,
    noalias policy: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    policy.* = pthread_attrs.schedule_policy;
    return 0;
}

pub fn pthread_attr_setschedpolicy(
    attr: [*c]pthread_attr_t,
    policy: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    pthread_attrs.schedule_policy = policy;
    return 0;
}

pub fn pthread_attr_getinheritsched(
    noalias attr: [*c]const pthread_attr_t,
    noalias inherit: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    inherit.* = pthread_attrs.schedule_inheritance;
    return 0;
}

pub fn pthread_attr_setinheritsched(
    attr: [*c]pthread_attr_t,
    inherit: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    pthread_attrs.schedule_inheritance = inherit;
    return 0;
}

pub fn pthread_attr_getscope(
    noalias attr: [*c]const pthread_attr_t,
    noalias scope: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    scope.* = pthread_attrs.schedule_scope;
    return 0;
}

pub fn pthread_attr_setscope(
    attr: [*c]pthread_attr_t,
    scope: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
    pthread_attrs.schedule_scope = scope;
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
    const pthread_attrs: *PthreadAttributes = attr.*;
    stacksize.* = pthread_attrs.stack_size;
    return 0;
}

pub fn pthread_attr_setstacksize(
    attr: [*c]pthread_attr_t,
    stacksize: usize,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = attr.*;
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
    pthread.attributes.schedule_policy = policy;
    pthread.attributes.schedule_parameters = param.*;
    return 0;
}

pub fn pthread_getschedparam(
    target_thread: pthread_t,
    noalias policy: [*c]c_int,
    noalias param: [*c]sched_param,
) callconv(.c) c_int {
    const pthread = Pthread.find(target_thread) orelse return errno(.INVAL);
    policy.* = pthread.attributes.schedule_policy;
    param.* = pthread.attributes.schedule_parameters;
    return 0;
}

pub fn pthread_setschedprio(
    target_thread: pthread_t,
    prio: c_int,
) callconv(.c) c_int {
    const pthread = Pthread.find(target_thread) orelse return errno(.INVAL);
    pthread.attributes.schedule_parameters.sched_priority = prio;
    return 0;
}

pub fn pthread_once(
    once_control: [*c]pthread_once_t,
    init_routine: ?*const fn () callconv(.c) void,
) callconv(.c) c_int {
    _ = once_control;
    _ = init_routine;
    @panic("not implemented");
}

pub fn pthread_setcancelstate(
    state: c_int,
    oldstate: [*c]c_int,
) callconv(.c) c_int {
    _ = state;
    _ = oldstate;
    @panic("not implemented");
}

pub fn pthread_setcanceltype(
    cantype: c_int,
    oldtype: [*c]c_int,
) callconv(.c) c_int {
    _ = cantype;
    _ = oldtype;
    @panic("not implemented");
}

pub fn pthread_cancel(
    th: pthread_t,
) callconv(.c) c_int {
    _ = th;
    @panic("not implemented");
}

pub fn pthread_testcancel() callconv(.c) void {
    @panic("not implemented");
}

const PthreadMutex = struct {
    mutex: std.Thread.Mutex = .{},
    lock_count: usize = 0,
    ref_count: std.atomic.Value(usize) = .init(1),
    thread_id: std.atomic.Value(pthread_t) = .init(0),
    wait_futex: std.atomic.Value(u32) = .init(0),
    attributes: PthreadMutexAttributes = .{},

    fn extract(mutex: [*c]const pthread_mutex_t) *@This() {
        return if (mutex.*) |pm| pm else init_static: {
            const pm = wasm_allocator.create(@This()) catch @panic("Out of memory");
            pm.* = .{};
            const mutable = @constCast(mutex);
            mutable.* = pm;
            break :init_static pm;
        };
    }

    fn addRef(self: *@This()) void {
        _ = self.ref_count.fetchAdd(1, .monotonic);
    }

    fn release(self: *@This()) void {
        if (self.ref_count.fetchSub(1, .monotonic) == 1) wasm_allocator.destroy(self);
    }

    fn wait(self: *@This(), duration: u64) void {
        self.wait_futex.store(0, .unordered);
        std.Thread.Futex.timedWait(&self.wait_futex, 0, duration) catch {};
    }

    fn wake(self: *@This()) void {
        if (self.wait_futex.load(.unordered) != 0) {
            self.wait_futex.store(1, .unordered);
            std.Thread.Futex.wake(&self.wait_futex, 1);
        }
    }
};
const PthreadMutexAttributes = struct {
    protocol: c_int = PTHREAD_PRIO_NONE,
    kind: c_int = PTHREAD_MUTEX_NORMAL,
    shared: c_int = PTHREAD_PROCESS_PRIVATE,
    priority_ceiling: c_int = 99,
    robustness: c_int = PTHREAD_MUTEX_STALLED,
};

pub fn pthread_mutex_init(
    mutex: [*c]pthread_mutex_t,
    mutexattr: [*c]const pthread_mutexattr_t,
) callconv(.c) c_int {
    const pthread_mutex_attrs: ?*const PthreadMutexAttributes = if (mutexattr) |ptr| @ptrCast(ptr.*) else null;
    const pthread_mutex: *PthreadMutex = if (pthread_mutex_attrs) |pma| get: {
        const pm: *PthreadMutex = @fieldParentPtr("attributes", @constCast(pma));
        pm.addRef();
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
    pthread_mutex.release();
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
    @panic("not implemented");
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
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    const pthread_mutex: *PthreadMutex = @fieldParentPtr("attributes", pthread_mutex_attrs);
    pthread_mutex.release();
    return 0;
}

pub fn pthread_mutexattr_getpshared(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    pshared.* = pthread_mutex_attrs.shared;
    return 0;
}

pub fn pthread_mutexattr_setpshared(
    attr: [*c]pthread_mutexattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    pthread_mutex_attrs.shared = pshared;
    return 0;
}

pub fn pthread_mutexattr_gettype(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias kind: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    kind.* = pthread_mutex_attrs.kind;
    return 0;
}

pub fn pthread_mutexattr_settype(
    attr: [*c]pthread_mutexattr_t,
    kind: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    pthread_mutex_attrs.kind = kind;
    return 0;
}

pub fn pthread_mutexattr_getprotocol(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias protocol: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    protocol.* = pthread_mutex_attrs.protocol;
    return 0;
}

pub fn pthread_mutexattr_setprotocol(
    attr: [*c]pthread_mutexattr_t,
    protocol: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    pthread_mutex_attrs.protocol = protocol;
    return 0;
}

pub fn pthread_mutexattr_getprioceiling(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias prioceiling: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    prioceiling.* = pthread_mutex_attrs.priority_ceiling;
    return 0;
}

pub fn pthread_mutexattr_setprioceiling(
    attr: [*c]pthread_mutexattr_t,
    prioceiling: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    pthread_mutex_attrs.priority_ceiling = prioceiling;
    return 0;
}

pub fn pthread_mutexattr_getrobust(
    attr: [*c]const pthread_mutexattr_t,
    robustness: [*c]c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    robustness.* = pthread_mutex_attrs.robustness;
    return 0;
}

pub fn pthread_mutexattr_setrobust(
    attr: [*c]pthread_mutexattr_t,
    robustness: c_int,
) callconv(.c) c_int {
    const pthread_mutex_attrs: *PthreadMutexAttributes = attr.*;
    pthread_mutex_attrs.robustness = robustness;
    return 0;
}

const PthreadRwLock = struct {
    lock: std.Thread.RwLock = .{},
    ref_count: std.atomic.Value(usize) = .init(1),
    reader_thread_spinlock: pthread_spinlock_t = 0,
    reader_thread_ids: std.ArrayListUnmanaged(pthread_t) = .{},
    writer_thread_id: pthread_t = 0,
    wait_futex: std.atomic.Value(u32) = .init(0),
    attributes: PthreadRwLockAttributes = .{},

    fn extract(rwlock: [*c]const pthread_rwlock_t) *@This() {
        return if (rwlock.*) |prw| prw else init_static: {
            const prw = wasm_allocator.create(@This()) catch @panic("Out of memory");
            prw.* = .{};
            const mutable = @constCast(rwlock);
            mutable.* = prw;
            break :init_static prw;
        };
    }

    fn addRef(self: *@This()) void {
        _ = self.ref_count.fetchAdd(1, .acq_rel);
    }

    fn release(self: *@This()) void {
        if (self.ref_count.fetchSub(1, .acq_rel) == 1) {
            self.reader_thread_ids.deinit(wasm_allocator);
            wasm_allocator.destroy(self);
        }
    }

    fn wait(self: *@This(), duration: u64) void {
        self.wait_futex.store(0, .unordered);
        std.Thread.Futex.timedWait(&self.wait_futex, 0, duration) catch {};
    }

    fn wake(self: *@This()) void {
        if (self.wait_futex.load(.unordered) != 0) {
            self.wait_futex.store(1, .unordered);
            std.Thread.Futex.wake(&self.wait_futex, 1);
        }
    }
};
const PthreadRwLockAttributes = struct {
    kind: c_int = PTHREAD_MUTEX_NORMAL,
    shared: c_int = PTHREAD_PROCESS_PRIVATE,
};

pub fn pthread_rwlock_init(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias attr: [*c]const pthread_rwlockattr_t,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: ?*const PthreadRwLockAttributes = if (attr) |ptr| @ptrCast(ptr.*) else null;
    const pthread_rwlock: *PthreadRwLock = if (pthread_rwlock_attrs) |prwa| get: {
        const prw: *PthreadRwLock = @fieldParentPtr("attributes", @constCast(prwa));
        prw.addRef();
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
    pthread_rwlock.release();
    return 0;
}

pub fn pthread_rwlock_rdlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    const pthread_rwlock = PthreadRwLock.extract(rwlock);
    pthread_rwlock.lock.lockShared();
    const thread_id = pthread_self();
    _ = pthread_spin_lock(&pthread_rwlock.reader_thread_spinlock);
    defer _ = pthread_spin_unlock(&pthread_rwlock.reader_thread_spinlock);
    pthread_rwlock.reader_thread_ids.append(wasm_allocator, thread_id) catch {
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
    _ = pthread_spin_lock(&pthread_rwlock.reader_thread_spinlock);
    defer _ = pthread_spin_unlock(&pthread_rwlock.reader_thread_spinlock);
    pthread_rwlock.reader_thread_ids.append(wasm_allocator, thread_id) catch {
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
        for (pthread_rwlock.reader_thread_ids.items, 0..) |id, index| {
            if (thread_id == id) {
                reader_index = index;
                break;
            }
        } else return errno(.PERM);
        pthread_rwlock.lock.unlockShared();
        _ = pthread_spin_lock(&pthread_rwlock.reader_thread_spinlock);
        defer _ = pthread_spin_unlock(&pthread_rwlock.reader_thread_spinlock);
        _ = pthread_rwlock.reader_thread_ids.swapRemove(reader_index);
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
    const pthread_rwlock_attrs: *PthreadRwLockAttributes = attr.*;
    const pthread_rwlock: *PthreadRwLock = @fieldParentPtr("attributes", pthread_rwlock_attrs);
    pthread_rwlock.release();
    return 0;
}

pub fn pthread_rwlockattr_getpshared(
    noalias attr: [*c]const pthread_rwlockattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLockAttributes = attr.*;
    pshared.* = pthread_rwlock_attrs.shared;
    return 0;
}

pub fn pthread_rwlockattr_setpshared(
    attr: [*c]pthread_rwlockattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLockAttributes = attr.*;
    pthread_rwlock_attrs.shared = pshared;
    return 0;
}

pub fn pthread_rwlockattr_getkind_np(
    noalias attr: [*c]const pthread_rwlockattr_t,
    noalias pref: [*c]c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLockAttributes = attr.*;
    pref.* = pthread_rwlock_attrs.kind;
    return 0;
}

pub fn pthread_rwlockattr_setkind_np(
    attr: [*c]pthread_rwlockattr_t,
    pref: c_int,
) callconv(.c) c_int {
    const pthread_rwlock_attrs: *PthreadRwLockAttributes = attr.*;
    pthread_rwlock_attrs.kind = pref;
    return 0;
}

const PthreadCondition = struct {
    condition: std.Thread.Condition = .{},
    ref_count: std.atomic.Value(usize) = .init(1),
    attributes: PthreadConditionAttributes = .{},

    fn extract(cond: [*c]const pthread_cond_t) *@This() {
        return if (cond.*) |pc| pc else init_static: {
            const pc = wasm_allocator.create(@This()) catch @panic("Out of memory");
            pc.* = .{};
            const mutable = @constCast(cond);
            mutable.* = pc;
            break :init_static pc;
        };
    }

    fn addRef(self: *@This()) void {
        _ = self.ref_count.fetchAdd(1, .acq_rel);
    }

    fn release(self: *@This()) void {
        if (self.ref_count.fetchSub(1, .acq_rel) == 1) wasm_allocator.destroy(self);
    }
};
const PthreadConditionAttributes = struct {
    shared: c_int = PTHREAD_PROCESS_PRIVATE,
    clock_id: std.posix.clockid_t = .REALTIME,
};

pub fn pthread_cond_init(
    noalias cond: [*c]pthread_cond_t,
    noalias attr: [*c]const pthread_condattr_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: ?*const PthreadConditionAttributes = if (attr) |ptr| @ptrCast(ptr.*) else null;
    const pthread_condition: *PthreadCondition = if (pthread_condition_attrs) |pca| get: {
        const pc: *PthreadCondition = @fieldParentPtr("attributes", @constCast(pca));
        pc.addRef();
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
    pthread_condition.release();
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
    const now = std.posix.clock_gettime(.REALTIME) catch return errno(.TIMEDOUT);
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
    const pthread_condition_attrs: *PthreadConditionAttributes = attr.*;
    const pthread_condition: *PthreadCondition = @fieldParentPtr("attributes", pthread_condition_attrs);
    pthread_condition.release();
    return 0;
}

pub fn pthread_condattr_getpshared(
    noalias attr: [*c]const pthread_condattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadConditionAttributes = attr.*;
    pshared.* = pthread_condition_attrs.shared;
    return 0;
}

pub fn pthread_condattr_setpshared(
    attr: [*c]pthread_condattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadConditionAttributes = attr.*;
    pthread_condition_attrs.shared = pshared;
    return 0;
}

pub fn pthread_condattr_getclock(
    noalias attr: [*c]const pthread_condattr_t,
    noalias clock_id: [*c]std.posix.clockid_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadConditionAttributes = attr.*;
    clock_id.* = pthread_condition_attrs.clock_id;
    return 0;
}

pub fn pthread_condattr_setclock(
    attr: [*c]pthread_condattr_t,
    clock_id: std.posix.clockid_t,
) callconv(.c) c_int {
    const pthread_condition_attrs: *PthreadConditionAttributes = attr.*;
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

pub fn pthread_key_create(
    key: [*c]pthread_key_t,
    destr_function: ?*const fn (?*anyopaque) callconv(.c) void,
) callconv(.c) c_int {
    _ = key;
    _ = destr_function;
    @panic("not implemented");
}

pub fn pthread_key_delete(
    key: pthread_key_t,
) callconv(.c) c_int {
    _ = key;
    @panic("not implemented");
}

pub fn pthread_getspecific(
    key: pthread_key_t,
) callconv(.c) ?*anyopaque {
    _ = key;
    @panic("not implemented");
}

pub fn pthread_setspecific(
    key: pthread_key_t,
    pointer: ?*const anyopaque,
) callconv(.c) c_int {
    _ = key;
    _ = pointer;
    @panic("not implemented");
}

pub fn pthread_getcpuclockid(
    thread_id: pthread_t,
    clock_id: [*c]std.posix.clockid_t,
) callconv(.c) c_int {
    _ = thread_id;
    _ = clock_id;
    @panic("not implemented");
}

pub fn pthread_atfork(
    prepare: ?*const fn () callconv(.c) void,
    parent: ?*const fn () callconv(.c) void,
    child: ?*const fn () callconv(.c) void,
) callconv(.c) c_int {
    _ = prepare;
    _ = parent;
    _ = child;
    @panic("not implemented");
}

const PthreadSemaphore = struct {
    semaphore: std.Thread.Semaphore = .{},
    ref_count: std.atomic.Value(usize) = .init(1),
    attributes: PthreadSemaphoreAttributes = .{},
    name: ?[]u8 = null,

    var list: LinkedList(*@This()) = .init(wasm_allocator);

    fn extract(sem: [*c]const sem_t) *@This() {
        return if (sem.*) |prw| @constCast(prw) else unreachable;
    }

    fn addRef(self: *@This()) void {
        _ = self.ref_count.fetchAdd(1, .monotonic);
    }

    fn release(self: *@This()) void {
        if (self.ref_count.fetchSub(1, .monotonic) == 1) {
            if (self.name) |slice| wasm_allocator.free(slice);
            wasm_allocator.destroy(self);
        }
    }

    fn match(ptr: **@This(), name: []const u8) bool {
        return std.mem.eql(u8, ptr.*.name.?, name);
    }
};
const PthreadSemaphoreAttributes = struct {
    shared: c_int = PTHREAD_PROCESS_PRIVATE,
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
    pthread_semaphore.release();
    return 0;
}

pub fn sem_open(
    name: [*c]const u8,
    oflag: c_int,
    ...,
) callconv(.c) [*c]sem_t {
    const flags: std.c.O = @bitCast(oflag);
    const name_s = name[0..std.mem.len(name)];
    const ptr = if (PthreadSemaphore.list.find(PthreadSemaphore.match, name_s)) |ptr| use: {
        if (flags.CREAT and flags.EXCL) return semErrno(.EXIST, SEM_FAILED);
        break :use ptr;
    } else create: {
        if (!flags.CREAT) return semErrno(.NOENT, SEM_FAILED);
        var va_list = @cVaStart();
        defer @cVaEnd(&va_list);
        _ = @cVaArg(&va_list, std.c.mode_t);
        const value = @cVaArg(&va_list, c_uint);
        const pthread_semaphore: *PthreadSemaphore = wasm_allocator.create(PthreadSemaphore) catch {
            return semErrno(.NOMEM, SEM_FAILED);
        };
        const name_dupe = wasm_allocator.dupe(u8, name_s) catch {
            wasm_allocator.destroy(pthread_semaphore);
            return semErrno(.NOMEM, SEM_FAILED);
        };
        pthread_semaphore.* = .{
            .semaphore = .{
                .permits = @intCast(value),
            },
            .attributes = .{ .shared = PTHREAD_PROCESS_SHARED },
            .name = name_dupe,
        };
        break :create PthreadSemaphore.list.push(pthread_semaphore) catch {
            pthread_semaphore.release();
            return semErrno(.NOMEM, SEM_FAILED);
        };
    };
    const pthread_semaphore = ptr.*;
    // newly created semaphore will have ref_count = 2, such that a call to sem_close()
    // wouldn't cause its deallocation
    pthread_semaphore.addRef();
    return @ptrCast(ptr);
}

pub fn sem_close(
    sem: [*c]sem_t,
) callconv(.c) c_int {
    const pthread_semaphore = PthreadSemaphore.extract(sem);
    if (pthread_semaphore.name == null) return semErrno(.INVAL, -1);
    pthread_semaphore.release();
    return 0;
}

pub fn sem_unlink(
    name: [*c]const u8,
) callconv(.c) c_int {
    const name_s = name[0..std.mem.len(name)];
    const ptr = PthreadSemaphore.list.find(PthreadSemaphore.match, name_s) orelse {
        return semErrno(.NOENT, -1);
    };
    defer PthreadSemaphore.list.release(ptr); // undo increment made by find()
    PthreadSemaphore.list.release(ptr); // remove from list
    const pthread_semaphore = ptr.*;
    pthread_semaphore.release();
    pthread_semaphore.release(); // extra release to deallocate it
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
const pthread_attr_t = *PthreadAttributes;
const pthread_mutexattr_t = *PthreadMutexAttributes;
const pthread_mutex_t = ?*PthreadMutex;
const pthread_condattr_t = *PthreadConditionAttributes;
const pthread_cond_t = ?*PthreadCondition;
const pthread_rwlockattr_t = *PthreadRwLockAttributes;
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
