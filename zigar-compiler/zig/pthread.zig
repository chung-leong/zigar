const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;

const LinkedList = @import("type/linked-list.zig").LinkedList;

const Pthread = struct {
    id: pthread_t = undefined,
    thread: std.Thread = undefined,
    start_routine: ?*const fn (?*anyopaque) callconv(.c) ?*anyopaque = undefined,
    arg: ?*anyopaque = undefined,
    return_value: ?*anyopaque = null,
    state: PthreadState = .joinable,
    attributes: PthreadAttributes = .{},

    const def_stack_size = 2 * 1024 * 1024;

    var list: LinkedList(@This()) = .init(wasm_allocator);
    var next_id: std.atomic.Value(pthread_t) = .init(1);

    threadlocal var current: ?*@This() = null;

    fn alloc() !*@This() {
        return try list.push(.{});
    }

    fn allocId() pthread_t {
        var id = next_id.fetchAdd(1, .monotonic);
        if (id == 0) id = next_id.fetchAdd(1, .monotonic);
        return id;
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
        if (@cmpxchgStrong(PthreadState, &self.state, expected, new, .monotonic, .monotonic) != null) {
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
    const detach = if (pthread_attrs) |pa| pa.detached == PTHREAD_CREATE_DETACHED) else false;
    pthread.id = Pthread.allocId();
    pthread.start_routine = start_routine;
    pthread.arg = arg;
    pthread.state = if (detach) .detached else .joinable;
    // create the actual thread through Zig std
    pthread.thread = .spawn(.{
        .allocator = wasm_allocator,
        .stack_size = if (pthread_attrs) |pa| pa.stack_size else Pthread.def_stack_size,
    }, run_pthread, pthread) catch return errno(.INVAL);
    if (detach) pthread.thread.detach();
    newthread.* = pthread.id;    
    return 0;
}

fn run_pthread(thread: *Pthread) void {
    // set threadlocal variable so pthread_self() can get itself
    Pthread.current = thread;
    thread.retval = thread.start_routine(thread.arg);
    Pthread.current = null;
}

pub fn pthread_exit(
    retval: ?*anyopaque,
) callconv(.c) noreturn {
    if (Pthread.current) |t| t.return_value = retval;
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
    return if (Pthread.current) |pthread| pthread.id else 0;
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
}

pub fn pthread_attr_destroy(
    attr: [*c]pthread_attr_t,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    const pthread: *Pthread = @fieldParentPtr("attributes", pthread_attrs);
    pthread.release();
}

pub fn pthread_attr_getdetachstate(
    attr: [*c]const pthread_attr_t,
    detachstate: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    detachstate.* = pthread_attrs.detached;
    return 0;
}

pub fn pthread_attr_setdetachstate(
    attr: [*c]pthread_attr_t,
    detachstate: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    pthread_attrs.detached = detachstate;
    return 0;
}

pub fn pthread_attr_getguardsize(
    attr: [*c]const pthread_attr_t,
    guardsize: [*c]usize,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    guardsize.* = pthread_attrs.guard_size;
    return 0;
}

pub fn pthread_attr_setguardsize(
    attr: [*c]pthread_attr_t,
    guardsize: usize,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    pthread_attrs.guard_size = guardsize;
    return 0;
}

pub fn pthread_attr_getschedparam(
    noalias attr: [*c]const pthread_attr_t,
    noalias param: [*c]sched_param,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    param.* = pthread_attrs.schedule_parameters;
    return 0;
}

pub fn pthread_attr_setschedparam(
    noalias attr: [*c]pthread_attr_t,
    noalias param: [*c]const sched_param,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    pthread_attrs.schedule_parameters = param;
    return 0;
}

pub fn pthread_attr_getschedpolicy(
    noalias attr: [*c]const pthread_attr_t,
    noalias policy: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    policy.* = pthread_attrs.schedule_policy;
    return 0;
}

pub fn pthread_attr_setschedpolicy(
    attr: [*c]pthread_attr_t,
    policy: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    pthread_attrs.schedule_policy = policy;
    return 0;
}

pub fn pthread_attr_getinheritsched(
    noalias attr: [*c]const pthread_attr_t,
    noalias inherit: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    inherit.* = pthread_attrs.schedule_inheritance;
    return 0;
}

pub fn pthread_attr_setinheritsched(
    attr: [*c]pthread_attr_t,
    inherit: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    pthread_attrs.schedule_inheritance = inherit;
    return 0;
}

pub fn pthread_attr_getscope(
    noalias attr: [*c]const pthread_attr_t,
    noalias scope: [*c]c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    scope.* = pthread_attrs.schedule_scope;
    return 0;
}

pub fn pthread_attr_setscope(
    attr: [*c]pthread_attr_t,
    scope: c_int,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
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
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
    stacksize.* = pthread_attrs.stack_size;
    return 0;
}

pub fn pthread_attr_setstacksize(
    attr: [*c]pthread_attr_t,
    stacksize: usize,
) callconv(.c) c_int {
    const pthread_attrs: *PthreadAttributes = @ptrCast(attr.*);
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
    return @intFromEnum(std.os.wasi.errno_t.OPNOTSUPP);
}

pub fn pthread_attr_setstack(
    attr: [*c]pthread_attr_t,
    stackaddr: ?*anyopaque,
    stacksize: usize,
) callconv(.c) c_int {
    _ = attr;
    _ = stackaddr;
    _ = stacksize;
    return @intFromEnum(std.os.wasi.errno_t.OPNOTSUPP);
}

pub fn pthread_setschedparam(
    target_thread: pthread_t,
    policy: c_int,
    param: [*c]const sched_param,
) callconv(.c) c_int {
    const pthread = Pthread.find(target_thread) orelse return errno(.INVAL);
    pthread.attributes.schedule_policy = policy;
    pthread.attributes.schedule_parameters = param;
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

pub fn pthread_mutex_init(
    mutex: [*c]pthread_mutex_t,
    mutexattr: [*c]const pthread_mutexattr_t,
) callconv(.c) c_int {
    _ = mutex;
    _ = mutexattr;
    @panic("not implemented");
}

pub fn pthread_mutex_destroy(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    _ = mutex;
    @panic("not implemented");
}

pub fn pthread_mutex_trylock(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    _ = mutex;
    @panic("not implemented");
}

pub fn pthread_mutex_lock(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    _ = mutex;
    @panic("not implemented");
}

pub fn pthread_mutex_timedlock(
    noalias mutex: [*c]pthread_mutex_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    _ = mutex;
    _ = abstime;
    @panic("not implemented");
}

pub fn pthread_mutex_unlock(
    mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    _ = mutex;
    @panic("not implemented");
}

pub fn pthread_mutex_getprioceiling(
    noalias mutex: [*c]const pthread_mutex_t,
    noalias prioceiling: [*c]c_int,
) callconv(.c) c_int {
    _ = mutex;
    _ = prioceiling;
    @panic("not implemented");
}

pub fn pthread_mutex_setprioceiling(
    noalias mutex: [*c]pthread_mutex_t,
    prioceiling: c_int,
    noalias old_ceiling: [*c]c_int,
) callconv(.c) c_int {
    _ = mutex;
    _ = prioceiling;
    _ = old_ceiling;
    @panic("not implemented");
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
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_mutexattr_destroy(
    attr: [*c]pthread_mutexattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_mutexattr_getpshared(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_mutexattr_setpshared(
    attr: [*c]pthread_mutexattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_mutexattr_gettype(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias kind: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = kind;
    @panic("not implemented");
}

pub fn pthread_mutexattr_settype(
    attr: [*c]pthread_mutexattr_t,
    kind: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = kind;
    @panic("not implemented");
}

pub fn pthread_mutexattr_getprotocol(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias protocol: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = protocol;
    @panic("not implemented");
}

pub fn pthread_mutexattr_setprotocol(
    attr: [*c]pthread_mutexattr_t,
    protocol: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = protocol;
    @panic("not implemented");
}

pub fn pthread_mutexattr_getprioceiling(
    noalias attr: [*c]const pthread_mutexattr_t,
    noalias prioceiling: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = prioceiling;
    @panic("not implemented");
}

pub fn pthread_mutexattr_setprioceiling(
    attr: [*c]pthread_mutexattr_t,
    prioceiling: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = prioceiling;
    @panic("not implemented");
}

pub fn pthread_mutexattr_getrobust(
    attr: [*c]const pthread_mutexattr_t,
    robustness: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = robustness;
    @panic("not implemented");
}

pub fn pthread_mutexattr_setrobust(
    attr: [*c]pthread_mutexattr_t,
    robustness: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = robustness;
    @panic("not implemented");
}

pub fn pthread_rwlock_init(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias attr: [*c]const pthread_rwlockattr_t,
) callconv(.c) c_int {
    _ = rwlock;
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_rwlock_destroy(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    _ = rwlock;
    @panic("not implemented");
}

pub fn pthread_rwlock_rdlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    _ = rwlock;
    @panic("not implemented");
}

pub fn pthread_rwlock_tryrdlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    _ = rwlock;
    @panic("not implemented");
}

pub fn pthread_rwlock_timedrdlock(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    _ = rwlock;
    _ = abstime;
    @panic("not implemented");
}

pub fn pthread_rwlock_wrlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    _ = rwlock;
    @panic("not implemented");
}

pub fn pthread_rwlock_trywrlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    _ = rwlock;
    @panic("not implemented");
}

pub fn pthread_rwlock_timedwrlock(
    noalias rwlock: [*c]pthread_rwlock_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    _ = rwlock;
    _ = abstime;
    @panic("not implemented");
}

pub fn pthread_rwlock_unlock(
    rwlock: [*c]pthread_rwlock_t,
) callconv(.c) c_int {
    _ = rwlock;
    @panic("not implemented");
}

pub fn pthread_rwlockattr_init(
    attr: [*c]pthread_rwlockattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_rwlockattr_destroy(
    attr: [*c]pthread_rwlockattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_rwlockattr_getpshared(
    noalias attr: [*c]const pthread_rwlockattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_rwlockattr_setpshared(
    attr: [*c]pthread_rwlockattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_rwlockattr_getkind_np(
    noalias attr: [*c]const pthread_rwlockattr_t,
    noalias pref: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pref;
    @panic("not implemented");
}

pub fn pthread_rwlockattr_setkind_np(
    attr: [*c]pthread_rwlockattr_t,
    pref: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pref;
    @panic("not implemented");
}

pub fn pthread_cond_init(
    noalias cond: [*c]pthread_cond_t,
    noalias cond_attr: [*c]const pthread_condattr_t,
) callconv(.c) c_int {
    _ = cond;
    _ = cond_attr;
    @panic("not implemented");
}

pub fn pthread_cond_destroy(
    cond: [*c]pthread_cond_t,
) callconv(.c) c_int {
    _ = cond;
    @panic("not implemented");
}

pub fn pthread_cond_signal(
    cond: [*c]pthread_cond_t,
) callconv(.c) c_int {
    _ = cond;
    @panic("not implemented");
}

pub fn pthread_cond_broadcast(
    cond: [*c]pthread_cond_t,
) callconv(.c) c_int {
    _ = cond;
    @panic("not implemented");
}

pub fn pthread_cond_wait(
    noalias cond: [*c]pthread_cond_t,
    noalias mutex: [*c]pthread_mutex_t,
) callconv(.c) c_int {
    _ = cond;
    _ = mutex;
    @panic("not implemented");
}

pub fn pthread_cond_timedwait(
    noalias cond: [*c]pthread_cond_t,
    noalias mutex: [*c]pthread_mutex_t,
    noalias abstime: [*c]const std.posix.timespec,
) callconv(.c) c_int {
    _ = cond;
    _ = mutex;
    _ = abstime;
    @panic("not implemented");
}

pub fn pthread_condattr_init(
    attr: [*c]pthread_condattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_condattr_destroy(
    attr: [*c]pthread_condattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_condattr_getpshared(
    noalias attr: [*c]const pthread_condattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_condattr_setpshared(
    attr: [*c]pthread_condattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_condattr_getclock(
    noalias attr: [*c]const pthread_condattr_t,
    noalias clock_id: [*c]std.posix.clockid_t,
) callconv(.c) c_int {
    _ = attr;
    _ = clock_id;
    @panic("not implemented");
}

pub fn pthread_condattr_setclock(
    attr: [*c]pthread_condattr_t,
    clock_id: std.posix.clockid_t,
) callconv(.c) c_int {
    _ = attr;
    _ = clock_id;
    @panic("not implemented");
}

pub fn pthread_spin_init(
    lock: [*c]volatile pthread_spinlock_t,
    pshared: c_int,
) callconv(.c) c_int {
    _ = lock;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_spin_destroy(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    _ = lock;
    @panic("not implemented");
}

pub fn pthread_spin_lock(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    _ = lock;
    @panic("not implemented");
}

pub fn pthread_spin_trylock(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    _ = lock;
    @panic("not implemented");
}

pub fn pthread_spin_unlock(
    lock: [*c]volatile pthread_spinlock_t,
) callconv(.c) c_int {
    _ = lock;
    @panic("not implemented");
}

pub fn pthread_barrier_init(
    noalias barrier: [*c]pthread_barrier_t,
    noalias attr: [*c]const pthread_barrierattr_t,
    count: c_uint,
) callconv(.c) c_int {
    _ = barrier;
    _ = attr;
    _ = count;
    @panic("not implemented");
}

pub fn pthread_barrier_destroy(
    barrier: [*c]pthread_barrier_t,
) callconv(.c) c_int {
    _ = barrier;
    @panic("not implemented");
}

pub fn pthread_barrier_wait(
    barrier: [*c]pthread_barrier_t,
) callconv(.c) c_int {
    _ = barrier;
    @panic("not implemented");
}

pub fn pthread_barrierattr_init(
    attr: [*c]pthread_barrierattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_barrierattr_destroy(
    attr: [*c]pthread_barrierattr_t,
) callconv(.c) c_int {
    _ = attr;
    @panic("not implemented");
}

pub fn pthread_barrierattr_getpshared(
    noalias attr: [*c]const pthread_barrierattr_t,
    noalias pshared: [*c]c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
}

pub fn pthread_barrierattr_setpshared(
    attr: [*c]pthread_barrierattr_t,
    pshared: c_int,
) callconv(.c) c_int {
    _ = attr;
    _ = pshared;
    @panic("not implemented");
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

const sched_param = extern struct {
    sched_priority: c_int,
};
const pthread_t = c_ulong;
const pthread_attr_t = *anyopaque;
const pthread_mutex_t = *anyopaque;
const pthread_mutexattr_t = *anyopaque;
const pthread_condattr_t = *anyopaque;
const pthread_cond_t = *anyopaque;
const pthread_rwlock_t = *anyopaque;
const pthread_rwlockattr_t = *anyopaque;
const pthread_barrier_t = *anyopaque;
const pthread_barrierattr_t = *anyopaque;
const pthread_key_t = c_uint;
const pthread_once_t = c_int;
const pthread_spinlock_t = c_int;

const SCHED_RR = 2;
const PTHREAD_INHERIT_SCHED = 0;
const PTHREAD_SCOPE_SYSTEM = 0;
const PTHREAD_CREATE_JOINABLE = 0;
const PTHREAD_CREATE_DETACHED = 1;

fn errno(e: std.posix.E) u16 {
    return @intFromEnum(e);
}
