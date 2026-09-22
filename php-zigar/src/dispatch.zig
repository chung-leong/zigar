const std = @import("std");
const c_allocator = std.heap.c_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const DynLib = @import("dyn-lib.zig").DynLib;
const EventLoop = @import("event-loop.zig").EventLoop;
const extension = @import("extension.zig");
const failure = @import("failure.zig");
const io = @import("system.zig").io;
const interface = @import("module/native/interface.zig");
const Jscall = interface.Jscall;
const Syscall = interface.Syscall;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const php_ng = @import("php/root.zig");
const c = php_ng.c;
const php_al = php_ng.allocator;
const Array = php_ng.Array;
const Function = php_ng.Function;
const Stream = php_ng.Stream;
const String = php_ng.String;
const Value = php_ng.Value;
const N = String.static;
const redirection = @import("redirection.zig");
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const CallDispatcher = struct {
    redirection_mask: Syscall.Mask = .{
        .open = true,
        .mkdir = true,
        .readlink = true,
        .rename = true,
        .rmdir = true,
        .stat = true,
        .symlink = true,
        .unlink = true,
        .utimes = true,
    },
    redirection_cb: ?Value = null,
    redirection_cache: Function.CallCache = undefined,
    redirecting_root: bool = false,
    redirecting_other_libraries: bool = false,
    function_list: std.ArrayList(CallbackEntry) = .empty,
    next_function_id: usize = 5, // 1-4 are reserve for the methods of the host allocator
    stream_list: std.ArrayList(StreamEntry) = .empty,
    stream_wrapper_surrogate_list: std.ArrayList(*StreamWrapperSurrogate) = .empty,
    host: *ModuleHost,
    hooks_installed: bool = false,
    syscall_trap_installed: bool = false,
    syscall_trap_count: usize = 0,
    thread_syscall_trap_list: std.ArrayList(*bool) = .empty,
    thread_syscall_trap_list_mutex: std.Io.Mutex = .init,
    env_variable_deferred: HookEntry.Deferred = .{},
    env_variable_list: ?[]?[*:0]const u8 = null,
    env_variable_bytes: ?[]const u8 = null,
    env_variable_ptr: *[*:null]?[*:0]const u8 = undefined,
    env_variable_original: *[*:null]?[*:0]const u8 = undefined,
    multithread_count: usize = 0,
    pipe_ptr: [*]c_int,
    release_resources_called: bool = false,

    pub threadlocal var trapping_syscalls: bool = true;
    pub threadlocal var event_loop: EventLoop(runScheduledTask) = .{};

    threadlocal var thread_initialized: bool = false;
    threadlocal var in_main_thread: bool = false;
    threadlocal var pipes: [2]c_int = undefined;
    threadlocal var total_multithread_count: usize = 0;

    var pipe_list_mutex: std.Io.Mutex = .init;
    var pipe_list: std.ArrayList(c_int) = .empty;

    pub const HookEntry = interface.HookEntry;
    pub const HandlerVTable = interface.HandlerVTable;

    const redirection_controller = redirection.Controller(@This());
    const CallbackEntry = struct {
        id: usize,
        class: *ZigClassEntry,
        callable: Value,
        cache: Function.CallCache,
        buffer: *ByteBuffer,

        pub fn deinit(self: *@This()) void {
            php.release(self.class.object);
            self.callable.release();
            // ByteBuffer.free() flags the contents of the buffer as invalid without
            // releasing the buffer;
            self.buffer.free();
            self.buffer.release();
            self.cache.deinit();
        }
    };
    const DirEntryIterator = struct {
        ref_count: usize = 1,
        index: usize = std.math.maxInt(usize),
        entries: std.ArrayList(php.DirEntry) = .empty,

        pub fn create() !*@This() {
            const self = try php_al.create(@This());
            self.* = .{};
            try self.addRootDirEntries();
            return self;
        }

        fn addRootDirEntries(self: *@This()) !void {
            inline for (.{ 1, 2 }) |level| {
                const entry = try self.entries.addOne(php_al);
                inline for (0..level) |i| entry.d_name[i] = '.';
                entry.d_name[level] = 0;
            }
        }

        pub fn next(self: *@This(), stream: *Stream) !?*c.php_stream_dirent {
            if (self.index == std.math.maxInt(usize)) {
                self.index = 0;
            } else {
                self.index += 1;
            }
            while (self.index >= self.entries.items.len) {
                const new_entry = try self.entries.addOne(php_al);
                if (!stream.readDirectory(new_entry)) {
                    _ = self.entries.pop();
                    return null;
                }
            }
            return &self.entries.items[self.index];
        }

        pub fn seek(self: *@This(), index: usize) void {
            self.index = if (index == 0) std.math.maxInt(usize) else index - 1;
        }

        pub fn reset(self: *@This()) void {
            if (self.index == std.math.maxInt(usize)) return;
            self.entries.clearRetainingCapacity();
            self.index = std.math.maxInt(usize);
            self.addRootDirEntries() catch unreachable;
        }

        pub fn addRef(self: *@This()) void {
            self.ref_count += 1;
        }

        pub fn release(self: *@This()) void {
            self.ref_count -= 1;
            if (self.ref_count == 0) {
                self.entries.deinit(php_al);
                php_al.destroy(self);
            }
        }
    };
    const StreamEntry = struct {
        fd: c_long,
        stream: *Stream,
        path: *String,
        fd_stat: std.os.wasi.fdstat_t,
        dir_iter: ?*DirEntryIterator = null,
        flags: packed struct {
            is_owner: bool = false,
            has_alias: bool = false,
        } = .{},

        pub fn deinit(self: *@This()) void {
            self.path.release();
            if (self.dir_iter) |iter| iter.release();
        }
    };
    const StreamWrapperSurrogate = struct {
        original: *Stream.Wrapper,
        wrapper: Stream.Wrapper,
        wops: Stream.Wrapper.Ops,
        dispatcher: *CallDispatcher,
        ref_count: usize = 1,

        pub fn init(original: *Stream.Wrapper, dispatcher: *CallDispatcher) !*@This() {
            const self = try php_al.create(@This());
            self.* = .{
                .original = original,
                .wrapper = original.*,
                .dispatcher = dispatcher,
                .wops = original.impl.wops.*,
            };
            // replace closer with hook function
            self.wops.stream_closer = close;
            self.wrapper.impl.wops = &self.wops;
            // keep a ref on the host so the dispatch doesn't disappear while the surrogate is in use
            dispatcher.host.addRef();
            return self;
        }

        pub fn addRef(self: *@This()) void {
            self.ref_count += 1;
        }

        pub fn release(self: *@This()) void {
            self.ref_count -= 1;
            if (self.ref_count == 0) {
                // remove this one from the list
                for (self.dispatcher.stream_wrapper_surrogate_list.items, 0..) |item, i| {
                    if (item == self) {
                        _ = self.dispatcher.stream_wrapper_surrogate_list.swapRemove(i);
                    }
                }
                // release the hhost
                self.dispatcher.host.release();
                php_al.destroy(self);
            }
        }

        pub fn close(zwrapper: [*c]c.php_stream_wrapper, zstrm: ?*c.php_stream) callconv(.c) c_int {
            // get pointer to dispatcher
            const w: *Stream.Wrapper = @ptrCast(zwrapper);
            const strm: *Stream = @ptrCast(zstrm.?);
            const self: *@This() = @fieldParentPtr("wrapper", w);
            defer self.release();
            self.dispatcher.removeStream(strm);
            strm.setWrapper(self.original);
            const func = self.original.impl.wops.*.stream_closer orelse return c.SUCCESS;
            return func(zwrapper, zstrm);
        }
    };
    const ScheduledTask = struct {
        self: *CallDispatcher,
        operation: Operation,

        pub const Operation = union(enum) {
            jscall: *Jscall,
            syscall: *Syscall,
            disable: void,
        };
    };
    const Futex = struct {
        const initial_value = 0xffff_ffff;

        value: std.atomic.Value(u32) = .init(initial_value),
        handle: usize,
        timeout: usize = 0,

        pub fn init(self: *@This()) usize {
            self.* = .{ .handle = @intFromPtr(self) };
            return self.handle;
        }

        pub fn wait(self: *@This()) E {
            if (self.timeout != 0) {
                const timeout: std.Io.Timeout = .{
                    .duration = .{
                        .raw = .fromNanoseconds(self.timeout),
                        .clock = .real,
                    },
                };
                std.Io.futexWaitTimeout(io, u32, &self.value.raw, initial_value, timeout) catch {
                    return E.SUCCESS;
                };
            } else {
                std.Io.futexWaitUncancelable(io, u32, &self.value.raw, initial_value);
            }
            const final_value = self.value.load(.acquire);
            return std.enums.fromInt(E, final_value) orelse .FAULT;
        }

        pub fn wake(handle: usize, result: E) void {
            if (handle == 0) return;
            const self: *@This() = @ptrFromInt(handle);
            if (self.handle != handle) return;
            self.value.store(@intFromEnum(result), .release);
            std.Io.futexWake(io, u32, &self.value.raw, 1);
        }
    };
    const fd_min = 0x00f0_0000;
    const fd_max = 0x00ff_ffff;

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php_al.create(@This());
        errdefer php_al.destroy(self);
        self.* = .{ .host = host, .pipe_ptr = &pipes };
        try extension.shutdown_callbacks.add(self, onRequestShutdown);
        return self;
    }

    pub fn deinit(self: *@This()) void {
        self.disableMultithread() catch {};
        if (self.syscall_trap_installed) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                redirection_controller.removeSyscallVtable(self, vtable) catch {};
            }
            redirection_controller.uninstallSyscallTrap();
        }
        extension.shutdown_callbacks.remove(self, onRequestShutdown);
        self.releaseResources();
        if (self.env_variable_list) |list| c_allocator.free(list);
        if (self.env_variable_bytes) |bytes| c_allocator.free(bytes);
        self.stream_wrapper_surrogate_list.deinit(php_al);
        php_al.destroy(self);
    }

    pub fn installHandler() !void {
        if (!thread_initialized) {
            in_main_thread = true;
            redirection_controller.installSignalHandler() catch {};
            try createPipes();
            pipe_list_mutex.lockUncancelable(io);
            defer pipe_list_mutex.unlock(io);
            for (pipes) |fd| try pipe_list.append(std.heap.c_allocator, fd);
        }
    }

    pub fn uninstallHandlers() void {
        trapping_syscalls = false;
        destroyPipes();
        redirection_controller.uninstallSignalHandler();
    }

    fn createPipes() !void {
        if (builtin.target.os.tag == .windows) {
            var read_handle: c.HANDLE = undefined;
            var write_handle: c.HANDLE = undefined;
            var security: c.SECURITY_ATTRIBUTES = .{
                .nLength = @sizeOf(c.SECURITY_ATTRIBUTES),
                .lpSecurityDescriptor = null,
                .bInheritHandle = c.TRUE,
            };
            if (c.CreatePipe(&read_handle, &write_handle, &security, 0) != c.TRUE) return error.UnableToOpenPipes;
            pipes[0] = c._open_osfhandle(@bitCast(@intFromPtr(read_handle)), c._O_RDONLY);
            pipes[1] = c._open_osfhandle(@bitCast(@intFromPtr(write_handle)), c._O_WRONLY);
        } else {
            if (c.pipe(&pipes) != 0) return error.UnableToOpenPipes;
            // set read end of pipe to non-blocking
            const flags = c.fcntl(pipes[0], c.F_GETFL, @as(c_int, 0));
            _ = c.fcntl(pipes[0], c.F_SETFL, flags | c.O_NONBLOCK);
        }
    }

    fn destroyPipes() void {
        for (pipes) |fd| _ = c.close(fd);
    }

    pub fn createJsThunk(self: *@This(), class: *ZigClassEntry, callable: Value, buffer: *ByteBuffer) !void {
        const fn_id = try self.saveCallback(class, callable, buffer);
        errdefer self.removeCallback(fn_id);
        const controller_address = getControllerAddress(class) catch {
            // controller is only available when there's a pointer type targeting the function
            return failure.report("no pointer type for '{s}'", .{
                class.getName(),
            });
        };
        const exports = self.host.module.exports;
        var thunk_address: usize = 0;
        const result = exports.create_js_thunk(controller_address, fn_id, &thunk_address);
        if (result != .SUCCESS) return error.Failure;
        const ptr: [*]const u8 = @ptrFromInt(thunk_address);
        std.debug.assert(buffer.flags.uninitialized);
        buffer.referenceBytes(ptr[0..0], null);
        buffer.flags.contains_special_contents = true;
    }

    pub fn destroyJsThunk(self: *@This(), class: *ZigClassEntry, buffer: *ByteBuffer) !void {
        if (!buffer.flags.uninitialized and buffer.flags.contains_special_contents) {
            const controller_address = try getControllerAddress(class);
            var fn_id: usize = 0;
            const exports = self.host.module.exports;
            const thunk_address = @intFromPtr(buffer.bytes.ptr);
            if (exports.destroy_js_thunk(controller_address, thunk_address, &fn_id) == .SUCCESS) {
                self.removeCallback(fn_id);
            }
        }
    }

    pub fn detachThunk(_: *@This(), buffer: *ByteBuffer) void {
        if (buffer.flags.contains_special_contents) {
            buffer.flags.contains_special_contents = false;
        }
    }

    fn getControllerAddress(class: *ZigClassEntry) !usize {
        const fn_static = class.getStaticData(structure.Function);
        const controller_address = fn_static.controller_address;
        return if (controller_address != 0) controller_address else error.Unexpected;
    }

    fn saveCallback(self: *@This(), class: *ZigClassEntry, callable: Value, buffer: *ByteBuffer) !usize {
        const cache = try Function.CallCache.init(callable);
        const fn_id = self.next_function_id;
        self.next_function_id += 1;
        try self.function_list.append(php_al, .{
            .id = fn_id,
            .class = class,
            .callable = callable.retain(),
            .cache = cache,
            .buffer = buffer,
        });
        php.addRef(class.object);
        buffer.addRef();
        return fn_id;
    }

    fn findCallback(self: *@This(), fn_id: usize) ?*CallbackEntry {
        return for (self.function_list.items) |*item| {
            if (item.id == fn_id) break item;
        } else null;
    }

    fn removeCallback(self: *@This(), fn_id: usize) void {
        for (self.function_list.items, 0..) |*item, i| {
            if (item.id == fn_id) {
                self.host.object_map.free(item.buffer);
                item.deinit();
                _ = self.function_list.swapRemove(i);
                break;
            }
        }
    }

    fn removeAllCallbacks(self: *@This()) void {
        // removal of the callback can cause the list to get deallocated
        // make a copy of it just in case
        var list = self.function_list;
        const exports = self.host.module.exports;
        for (list.items) |*item| {
            const buffer = item.buffer;
            // destroy thunks that have been detached as well
            if (!buffer.flags.uninitialized) {
                const controller_address = getControllerAddress(item.class) catch continue;
                var fn_id: usize = 0;
                const thunk_address = @intFromPtr(buffer.bytes.ptr);
                _ = exports.destroy_js_thunk(controller_address, thunk_address, &fn_id);
            }
            item.deinit();
        }
        list.deinit(php_al);
    }

    fn scheduleTask(self: *@This(), operation: ScheduledTask.Operation) !void {
        if (self.multithread_count == 0) return error.Disabled;
        const fd = self.pipe_ptr[1];
        const task: ScheduledTask = .{ .self = self, .operation = operation };
        if (builtin.target.os.tag == .windows) {
            const handle: c.HANDLE = @ptrFromInt(@as(usize, @bitCast(c._get_osfhandle(fd))));
            var written: c.DWORD = undefined;
            if (c.WriteFile(handle, &task, @sizeOf(ScheduledTask), &written, null) == c.FALSE) return error.Unexpected;
            if (written != @sizeOf(ScheduledTask)) return error.Unexpected;
        } else {
            const written = c.write(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
            if (written < 0) return error.Unexpected;
        }
    }

    pub fn releaseCallingThread(handle: usize, err: E) void {
        Futex.wake(handle, err);
    }

    pub fn handleJscall(self: *@This(), call: *Jscall) !E {
        if (in_main_thread) {
            const status = self.performJsCall(call) catch |err| switch (err) {
                error.EarlyRelease => return .SUCCESS,
                else => handleJsError(err),
            };
            Futex.wake(call.futex_handle, status);
            return status;
        } else {
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            self.scheduleTask(.{ .jscall = call }) catch |err| {
                return switch (err) {
                    error.Disabled => .PERM,
                    else => .FAULT,
                };
            };
            return futex.wait();
        }
    }

    pub fn handleJsError(err: anytype) E {
        const new_err = failure.report("unable to execute callback: {s}", .{
            failure.acquireMessage(err),
        });
        php.triggerWarning(new_err);
        return .FAULT;
    }

    fn performJsCall(self: *@This(), call: *Jscall) !E {
        const arg_ptr: [*]u8 = @ptrFromInt(call.arg_address);
        const arg_bytes = arg_ptr[0..call.arg_size];
        switch (call.fn_id) {
            1...4 => |id| return try ModuleHost.handleAllocatorMethodCall(id, arg_bytes),
            else => {
                const cb = self.findCallback(call.fn_id) orelse return .FAULT;
                // use the function structure's static method to run the callback
                const fn_static = cb.class.getStaticData(structure.Function);
                try fn_static.runCallback(&cb.cache, arg_bytes, call.futex_handle);
                return .SUCCESS;
            },
        }
    }

    pub fn handleSyscall(self: *@This(), call: *Syscall) !E {
        if (in_main_thread) {
            const status = self.performSyscall(call) catch .FAULT;
            Futex.wake(call.futex_handle, status);
            return status;
        } else {
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            self.scheduleTask(.{ .syscall = call }) catch |err| {
                return switch (err) {
                    error.Disabled => .PERM,
                    else => .FAULT,
                };
            };
            return futex.wait();
        }
    }

    fn performSyscall(self: *@This(), call: *Syscall) !E {
        const status = switch (call.cmd) {
            .open => try self.handleOpen(&call.u.open),
            .close => try self.handleClose(&call.u.close),
            .read => try self.handleRead(&call.u.read),
            .readv => try self.handleVectorRead(&call.u.readv),
            .pread => try self.handlePositionalRead(&call.u.pread),
            .preadv => try self.handlePositionalVectorRead(&call.u.preadv),
            .write => try self.handleWrite(&call.u.write),
            .writev => try self.handleVectorWrite(&call.u.writev),
            .pwrite => try self.handlePositionalWrite(&call.u.pwrite),
            .pwritev => try self.handlePositionalVectorWrite(&call.u.pwritev),
            .seek => try self.handleSeek(&call.u.seek),
            .tell => try self.handleTell(&call.u.tell),
            .getfl => try self.handleGetDescriptorFlags(&call.u.getfl),
            .setfl => try self.handleSetDescriptorFlags(&call.u.setfl),
            .getlk => try self.handleGetLock(&call.u.getlk),
            .setlk => try self.handleSetLock(&call.u.setlk),
            .fstat => try self.handleStat(&call.u.fstat),
            .stat => try self.handleStat(&call.u.stat),
            .ftruncate => try self.handleTruncate(&call.u.ftruncate),
            .truncate => try self.handleTruncate(&call.u.truncate),
            .futimes => try self.handleSettimes(&call.u.futimes),
            .utimes => try self.handleSettimes(&call.u.utimes),
            .advise => try self.handleAdvise(&call.u.advise),
            .allocate => try self.handleAllocate(&call.u.allocate),
            .sync => try self.handleSync(&call.u.sync),
            .datasync => try self.handleDatasync(&call.u.datasync),
            .getdents => try self.handleGetdents(&call.u.getdents),
            .mkdir => try self.handleMkdir(&call.u.mkdir),
            .rmdir => try self.handleRmdir(&call.u.rmdir),
            .unlink => try self.handleUnlink(&call.u.unlink),
            .readlink => try self.handleReadlink(&call.u.readlink),
            .symlink => try self.handleSymlink(&call.u.symlink),
            .rename => try self.handleRename(&call.u.rename),
            .poll => try self.handlePoll(&call.u.poll),
            .copyfilerange => try self.handleCopyFileRange(&call.u.copyfilerange),
            .environ => try self.handleGetEnvironmentStrings(&call.u.environ),
            .write_stderr => try self.handleWriteStderr(&call.u.write_stderr),
        };
        return status;
    }

    pub fn installHooks(self: *@This(), lib: *DynLib, redirect_syscalls: bool) !void {
        const pos = try redirection_controller.installHooks(self, lib);
        if (redirect_syscalls) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                try redirection_controller.addSyscallVtable(self, pos, vtable);
                errdefer redirection_controller.removeSyscallVtable(self, vtable) catch {};
                if (redirection_controller.installSyscallTrap(&trapping_syscalls)) {
                    self.syscall_trap_installed = true;
                } else |_| {}
            }
            self.hooks_installed = true;
        }
    }

    pub fn getSyscallHook(self: *@This(), name: [*:0]const u8) ?HookEntry {
        const module = self.host.module;
        var hook: HookEntry = undefined;
        return if (module.exports.get_syscall_hook(name, &hook) == .SUCCESS) .{
            .handler = hook.handler,
            .original = hook.original,
        } else if (std.mem.eql(u8, name[0..std.mem.len(name)], "environ")) .{
            // get the address to the pointer
            .handler = undefined,
            .original = undefined,
            .deferred = &self.env_variable_deferred,
        } else null;
    }

    pub fn getSyscallMask(self: *@This(), ptr: *Syscall.Mask) !void {
        var mask = self.redirection_mask;
        // a stat request can be handled by a 'stat' or an 'open' event handler
        if (mask.open) mask.stat = true;
        ptr.* = mask;
    }

    pub fn releaseFunction(self: *@This(), fn_id: usize) !void {
        self.removeCallback(fn_id);
    }

    pub fn redirectSyscalls(self: *@This(), ptr: *const anyopaque) !void {
        if (!self.hooks_installed) return error.RedirectionDisabled;
        const pos = try redirection_controller.installHooksInLibraryOf(self, ptr);
        if (self.syscall_trap_installed) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                return redirection_controller.addSyscallVtable(self, pos, vtable);
            }
        }
    }

    pub fn enableMultithread(self: *@This()) !void {
        if (in_main_thread) {
            self.multithread_count += 1;
            total_multithread_count += 1;
            if (total_multithread_count > 1) return;
            const strm = try Stream.openDescriptor(pipes[0], "r");
            errdefer strm.close(true);
            if (builtin.target.os.tag != .windows) {
                try strm.setBlocking(false);
            }
            const strm_value = strm.toValue();
            defer strm_value.release();
            try event_loop.init(strm_value);
        } else {
            return error.NotInMainThread;
        }
    }

    pub fn disableMultithread(self: *@This()) !void {
        if (in_main_thread) {
            if (self.multithread_count == 0) return;
            self.multithread_count -= 1;
            total_multithread_count -= 1;
            if (total_multithread_count > 0) return;
            event_loop.deinit();
        } else {
            try self.scheduleTask(.{ .disable = {} });
        }
    }

    fn runScheduledTask() void {
        const fd = pipes[0];
        var task: ScheduledTask = undefined;
        if (builtin.target.os.tag == .windows) {
            const handle: c.HANDLE = @ptrFromInt(@as(usize, @bitCast(c._get_osfhandle(fd))));
            var available: c.DWORD = undefined;
            if (c.PeekNamedPipe(handle, null, 0, null, &available, null) == c.FALSE) return;
            if (available < @sizeOf(ScheduledTask)) return;
        }
        const read = c.read(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
        if (read != @sizeOf(ScheduledTask)) return;
        const self = task.self;
        switch (task.operation) {
            .jscall => |call| _ = self.handleJscall(call) catch unreachable,
            .syscall => |call| _ = self.handleSyscall(call) catch unreachable,
            .disable => self.disableMultithread() catch unreachable,
        }
        event_loop.resumePendingFiber();
    }

    pub fn initializeThread(self: *@This()) !void {
        in_main_thread = false;
        if (self.syscall_trap_installed) {
            try redirection_controller.installSyscallTrap(&trapping_syscalls);
            self.thread_syscall_trap_list_mutex.lockUncancelable(io);
            defer self.thread_syscall_trap_list_mutex.unlock(io);
            try self.thread_syscall_trap_list.append(std.heap.c_allocator, &trapping_syscalls);
            if (self.syscall_trap_count > 0) {
                trapping_syscalls = true;
            }
        }
        const module = self.host.module;
        _ = module.exports.set_host_instance(@ptrCast(self.host));
    }

    pub fn deinitializeThread(self: *@This()) !void {
        if (self.syscall_trap_installed) {
            self.thread_syscall_trap_list_mutex.lockUncancelable(io);
            defer self.thread_syscall_trap_list_mutex.unlock(io);
            const index = for (self.thread_syscall_trap_list.items, 0..) |ptr, i| {
                if (ptr == &trapping_syscalls) break i;
            } else return;
            _ = self.thread_syscall_trap_list.swapRemove(index);
        }
    }

    pub fn setEnvironmentVariables(self: *@This(), array: *Array) !void {
        if (self.env_variable_list) |list| {
            c_allocator.free(list);
            self.env_variable_list = null;
        }
        if (self.env_variable_bytes) |bytes| {
            c_allocator.free(bytes);
            self.env_variable_bytes = null;
        }
        const deferred = &self.env_variable_deferred;
        const count = array.length();
        var len: usize = 0;
        var iter = array.iterate(.{});
        while (iter.next()) |value| {
            const name = try iter.key().getString();
            const value_str = try value.getString();
            len += name.length() + 1 + value_str.length() + 1;
        }
        const list = try c_allocator.alloc(?[*:0]const u8, count + 1);
        errdefer c_allocator.free(list);
        const bytes = try c_allocator.alloc(u8, len + 1);
        errdefer c_allocator.free(bytes);
        iter.reset();
        var offset: usize = 0;
        var index: usize = 0;
        while (iter.next()) |value| {
            list[index] = @ptrCast(bytes.ptr + offset);
            const name = try iter.key().getString();
            const value_str = try value.getString();
            const name_s = name.slice();
            @memcpy(bytes[offset .. offset + name_s.len], name_s);
            bytes[offset + name_s.len] = '=';
            offset += name_s.len + 1;
            const value_s = value_str.slice();
            @memcpy(bytes[offset .. offset + value_s.len], value_s);
            bytes[offset + value_s.len] = 0;
            offset += value_s.len + 1;
            index += 1;
        }
        list[count] = null;
        bytes[len] = 0;
        self.env_variable_ptr = @ptrCast(list.ptr);
        if (deferred.address != 0 and !deferred.installed) {
            const hook: HookEntry = .{
                .handler = @ptrCast(&self.env_variable_ptr),
                .original = @ptrCast(&self.env_variable_original),
            };
            try redirection_controller.installHook(hook, deferred.address, deferred.read_only);
            deferred.installed = true;
        }
        self.env_variable_list = list;
        self.env_variable_bytes = bytes;
    }

    pub fn isVirtualStream(_: *@This(), fd: c_long) bool {
        return fd >= fd_min and fd <= fd_max;
    }

    pub fn addStream(self: *@This(), strm: *Stream, is_dir: bool) !c_long {
        return for (self.stream_list.items) |*item| {
            if (item.stream == strm) break item.fd;
        } else create: {
            const fd = try self.createDescriptor();
            const path = try getStreamPath(strm);
            defer path.release();
            const fdstat = getStreamStat(strm, is_dir);
            // the surrogate wrapper's stream_closer will call removeStream() to close the file
            // descriptor then call the original function
            const org_wrapper = strm.wrapper();
            const new_wrapper = try self.getSurrogateWrapper(org_wrapper);
            strm.setWrapper(new_wrapper);
            _ = try self.addStreamEntry(fd, path, strm, &fdstat);
            break :create fd;
        };
    }

    fn addStreamEntry(self: *@This(), fd: c_long, path: *String, strm: *Stream, stat: *const std.os.wasi.fdstat_t) !*StreamEntry {
        const entry = try self.stream_list.addOne(php_al);
        entry.* = .{
            .fd = fd,
            .path = path.retain(),
            .stream = strm,
            .fd_stat = stat.*,
        };
        if (stat.fs_filetype == .DIRECTORY) {
            entry.dir_iter = try DirEntryIterator.create();
        }
        return entry;
    }

    pub fn removeStream(self: *@This(), strm: *Stream) void {
        for (self.stream_list.items, 0..) |*item, i| {
            if (item.stream == strm) {
                item.deinit();
                _ = self.stream_list.swapRemove(i);
                break;
            }
        }
    }

    pub fn closeDescriptor(self: *@This(), fd: c_long) !void {
        if (fd == -1) self.redirecting_root = false;
        for (self.stream_list.items, 0..) |*item, i| {
            if (item.fd == fd) {
                const has_alias_still = item.flags.has_alias and for (self.stream_list.items) |*other| {
                    if (other.fd != fd and other.stream == item.stream) break true;
                } else false;
                if (has_alias_still) {
                    // just remove entry
                    item.deinit();
                    _ = self.stream_list.swapRemove(i);
                } else {
                    // close the stream--the stream's close handler will call removeStream()
                    item.stream.close(item.flags.is_owner);
                }
                break;
            }
        } else return error.Unexpected;
    }

    fn duplicateStreamEntry(self: *@This(), entry: *StreamEntry) !*StreamEntry {
        entry.flags.has_alias = true;
        const new_fd = try self.createDescriptor();
        const new_entry = try self.addStreamEntry(new_fd, entry.path, entry.stream, &entry.fd_stat);
        new_entry.flags.has_alias = true;
        new_entry.flags.is_owner = entry.flags.is_owner;
        if (entry.dir_iter) |iter| {
            new_entry.dir_iter = iter;
            iter.addRef();
        }
        return new_entry;
    }

    fn findStreamEntryWithFdPath(self: *@This(), path: [*:0]const u8) ?*StreamEntry {
        // look for stream entry that match php://fd/$fd URL where $fd is a virtual file descriptor
        const prefix = "/php://fd/";
        const slice = std.mem.sliceTo(path, 0);
        if (slice.len > prefix.len and std.mem.eql(u8, slice[0..prefix.len], prefix)) {
            const num_str = slice[prefix.len..];
            if (std.fmt.parseInt(c_long, num_str, 10) catch null) |fd| {
                if (self.isVirtualStream(fd)) {
                    for (self.stream_list.items) |*item| {
                        if (item.fd == fd) return item;
                    }
                }
            }
        }
        return null;
    }

    fn getSurrogateWrapper(self: *@This(), wrapper: *Stream.Wrapper) !*Stream.Wrapper {
        return for (self.stream_wrapper_surrogate_list.items) |item| {
            if (item.original == wrapper) {
                item.addRef();
                break &item.wrapper;
            }
        } else create: {
            const surrogate: *StreamWrapperSurrogate = try .init(wrapper, self);
            try self.stream_wrapper_surrogate_list.append(php_al, surrogate);
            break :create &surrogate.wrapper;
        };
    }

    fn removeAllStreams(self: *@This()) void {
        var list = self.stream_list;
        while (list.pop()) |*item| @constCast(item).deinit();
        list.deinit(php_al);
    }

    pub fn getStreamPath(strm: *Stream) !*String {
        if (strm.getPath()) |path| return .create(path);
        const value = strm.getWrapperProperty("path") catch {
            return failure.report("stream wrapper does not have the property 'path'", .{});
        };
        defer value.release();
        const path = value.getString() catch {
            return failure.report("stream wrapper's 'path' property is not a string", .{});
        };
        return path.retain();
    }

    pub fn getStreamStat(strm: *Stream, is_dir: bool) std.os.wasi.fdstat_t {
        const filetype: std.os.wasi.filetype_t = get: {
            var stat: std.os.wasi.filestat_t = undefined;
            break :get if (strm.stat(&stat))
                stat.filetype
            else |_| if (is_dir) .DIRECTORY else .CHARACTER_DEVICE;
        };
        var fdstat: std.os.wasi.fdstat_t = .{
            .fs_filetype = filetype,
            .fs_flags = .{},
            .fs_rights_base = .{},
            .fs_rights_inheriting = .{},
        };
        const mode = strm.getMode() orelse "r";
        for (mode) |code| {
            switch (code) {
                'r' => fdstat.fs_rights_base.FD_READ = true,
                'w', 'x', 'c' => fdstat.fs_rights_base.FD_WRITE = true,
                '+' => {
                    fdstat.fs_rights_base.FD_READ = true;
                    fdstat.fs_rights_base.FD_WRITE = true;
                },
                'a' => {
                    fdstat.fs_flags.APPEND = true;
                },
                else => {},
            }
        }
        fdstat.fs_rights_base.FD_READDIR = is_dir;
        return fdstat;
    }

    pub fn redirectStream(self: *@This(), fd: c_long, arg: Value) !void {
        if (fd == -1) {
            if (self.redirection_cb) |*cb| {
                cb.release();
                self.redirection_cb = null;
                self.redirecting_root = false;
            }
            if (Function.CallCache.init(arg) catch null) |cache| {
                self.redirection_cb = arg.retain();
                self.redirection_cache = cache;
                self.redirecting_root = true;
                self.closeDescriptor(fd) catch {};
                return;
            }
        }
        const strm = try arg.getStream();
        const path = try getStreamPath(strm);
        defer path.release();
        const fdstat = getStreamStat(strm, fd == -1);
        self.closeDescriptor(fd) catch {};
        _ = try self.addStreamEntry(fd, path, strm, &fdstat);
        if (fd == -1) self.redirecting_root = true;
    }

    fn findStreamEntry(self: *@This(), fd: c_long) !*StreamEntry {
        for (self.stream_list.items) |*item| {
            if (item.fd == fd) return item;
        } else {
            const path_s: []const u8, const mode: [*:0]const u8 = switch (fd) {
                0 => .{ "php://input", "r" },
                1, 2 => .{ "php://output", "w" },
                else => return error.Unexpected,
            };
            const path: *String = .create(path_s);
            defer path.release();
            const strm = Stream.open(path, mode, null, 0) catch return error.Unexpected;
            errdefer strm.close(true);
            const fdstat: std.os.wasi.fdstat_t = .{
                .fs_filetype = .CHARACTER_DEVICE,
                .fs_flags = .{},
                .fs_rights_base = .{
                    .FD_READ = mode[0] == 'r',
                    .FD_WRITE = mode[0] == 'w',
                },
                .fs_rights_inheriting = .{},
            };
            const entry = try self.addStreamEntry(fd, path, strm, &fdstat);
            entry.flags.is_owner = true;
            return entry;
        }
    }

    fn findStream(self: *@This(), fd: c_long) !*Stream {
        const entry = try self.findStreamEntry(fd);
        return entry.stream;
    }

    fn useStream(self: *@This(), fd: c_long, mode: [*c]const u8) !@Tuple(&.{ *Stream, bool }) {
        switch (fd) {
            0, 1, 2, fd_min...fd_max => {
                const strm = try self.findStream(fd);
                return .{ strm, false };
            },
            else => {
                const strm = try Stream.openDescriptor(@intCast(fd), mode);
                return .{ strm, true };
            },
        }
    }

    fn createDescriptor(self: *@This()) !c_long {
        var fd: c_long = fd_min;
        return while (fd < fd_max) : (fd += 1) {
            for (self.stream_list.items) |item| {
                if (item.fd == fd) break;
            } else return fd;
        } else error.OutOfDescriptor;
    }

    fn getWrapperUrl(path: []const u8) ?*String {
        var start: usize = 0;
        for (path, 0..) |char, i| {
            if (char == ':') {
                if (i < path.len - 1 and path[i + 1] == '/') {
                    if (i < path.len - 2 and path[i + 2] == '/') {
                        return .create(path[start..]);
                    } else {
                        // assume the '//' in 'protocol://host' got replaced by a single slash
                        const len = path.len - start + 1;
                        const str: *String = .createUnitialized(len);
                        const slice = @constCast(str.slice());
                        const j = i - start;
                        @memcpy(slice[0..j], path[start..i]);
                        @memcpy(slice[j .. j + 3], "://");
                        @memcpy(slice[j + 3 ..], path[i + 2 ..]);
                        slice.ptr[len] = 0;
                        return str;
                    }
                }
            } else if (i == 0 and (char == '/' or char == '\\')) {
                start += 1;
            } else if (!std.ascii.isAlphanumeric(char)) {
                break;
            }
        }
        return null;
    }

    const PathInfo = struct {
        url: *String,
        context: ?*Stream.Context = null,

        pub fn deinit(self: *const @This()) void {
            self.url.release();
            if (self.context) |cxt| cxt.resource().release();
        }
    };

    fn resolvePath(self: *@This(), dirfd: i32, path_c: [*:0]const u8) !?PathInfo {
        const path = path_c[0..std.mem.len(path_c)];
        var context: ?*Stream.Context = null;
        const url = getWrapperUrl(path) orelse find: {
            if (dirfd == -1) {
                // if a callback was given, call it to see if this path should be redirected somewhere else
                if (self.redirection_cb != null) {
                    const args: [1]Value = .{.fromString(.create(path))};
                    defer args[0].release();
                    const retval = try self.redirection_cache.invoke(&args);
                    defer retval.release();
                    switch (retval.kind()) {
                        .null => return null,
                        .string => break :find retval.string().retain(),
                        .resource => {
                            const strm = try retval.getStream();
                            const strm_path = try getStreamPath(strm);
                            defer strm_path.release();
                            context = strm.getContext();
                            break :find joinPath(strm_path.slice(), path);
                        },
                        .boolean => {
                            if (retval.boolean() == false) return null;
                            failure.warn("root redirection callback can return false but not true", .{});
                            return error.InvalidReturnValueFromCallback;
                        },
                        else => |t| {
                            failure.warn("invalid return value from root redirection callback: {s}", .{@tagName(t)});
                            return error.InvalidReturnValueFromCallback;
                        },
                    }
                }
                // don't bother lookup the root stream if the root descriptor hasn't been redirected
                if (!self.redirecting_root) return null;
            }
            const parent = try self.findStreamEntry(dirfd);
            context = parent.stream.getContext();
            break :find joinPath(parent.path.slice(), path);
        };
        if (context) |cxt| cxt.resource().addRef();
        return .{ .url = url, .context = context };
    }

    fn joinPath(parent_path: []const u8, path: []const u8) *String {
        const slash_count: usize = init: {
            if (parent_path[parent_path.len - 1] != '/') {
                if (path[0] != '/') break :init 1;
            }
            break :init 0;
        };
        const len = parent_path.len + slash_count + path.len;
        const str: *String = .createUnitialized(len);
        const slice = @constCast(str.slice());
        @memcpy(slice[0..parent_path.len], parent_path);
        if (slash_count == 1) slice[parent_path.len] = '/';
        @memcpy(slice[parent_path.len + slash_count .. len], path);
        return str;
    }

    fn handleOpen(self: *@This(), args: anytype) !E {
        if (self.findStreamEntryWithFdPath(args.path)) |entry| {
            const new_entry = self.duplicateStreamEntry(entry) catch return .MFILE;
            args.fd = @intCast(new_entry.fd);
            return .SUCCESS;
        }
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const strm, const file_type: std.os.wasi.filetype_t = open: {
            if (args.rights.FD_READDIR) {
                // opening a directory
                if (Stream.openDirectory(loc.url, 0, null) catch null) |strm| {
                    break :open .{ strm, .DIRECTORY };
                }
            }
            const mode = if (args.rights.FD_WRITE)
                if (args.open_flags.CREAT)
                    if (args.descriptor_flags.APPEND)
                        if (args.rights.FD_READ) "a+" else "a"
                    else if (args.open_flags.EXCL)
                        if (args.rights.FD_READ) "x+" else "x"
                    else if (args.open_flags.TRUNC)
                        if (args.rights.FD_READ) "w+" else "w"
                    else if (args.rights.FD_READ) "c+" else "c"
                else
                    "r+"
            else
                "r";
            const strm = Stream.open(loc.url, mode, loc.context, 0) catch return .NOENT;
            break :open .{ strm, .REGULAR_FILE };
        };
        errdefer strm.close(true);
        const stat: std.os.wasi.fdstat_t = .{
            .fs_filetype = file_type,
            .fs_flags = args.descriptor_flags,
            .fs_rights_base = args.rights,
            .fs_rights_inheriting = .{},
        };
        const fd = self.createDescriptor() catch return .MFILE;
        const entry = self.addStreamEntry(fd, loc.url, strm, &stat) catch return .MFILE;
        entry.flags.is_owner = true;
        args.fd = @intCast(fd);
        return .SUCCESS;
    }

    fn handleClose(self: *@This(), args: anytype) !E {
        self.closeDescriptor(args.fd) catch return .BADF;
        return .SUCCESS;
    }

    fn handleRead(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const slice = args.bytes[0..args.len];
        const read = strm.read(slice) catch return .INVAL;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handleVectorRead(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            const slice = iov.base[0..iov.len];
            total += strm.read(slice) catch return .INVAL;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalRead(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const pos = strm.tell() catch return .SPIPE;
        defer strm.seek(@intCast(pos), 0) catch {};
        strm.seek(@intCast(args.offset), 0) catch return .SPIPE;
        const slice = args.bytes[0..args.len];
        const read = strm.read(slice) catch return .IO;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handlePositionalVectorRead(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const pos = strm.tell() catch return .SPIPE;
        defer strm.seek(@intCast(pos), 0) catch {};
        strm.seek(@intCast(args.offset), 0) catch return .SPIPE;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            const slice = iov.base[0..iov.len];
            total += strm.read(slice) catch return .INVAL;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handleWrite(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const slice = args.bytes[0..args.len];
        const written = strm.write(slice) catch return .INVAL;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handleWriteStderr(self: *@This(), args: anytype) !E {
        const strm = self.findStream(2) catch return .BADF;
        const slice = args.bytes[0..args.len];
        _ = strm.write(slice) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleVectorWrite(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            const slice = iov.base[0..iov.len];
            total += strm.write(slice) catch return .INVAL;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalWrite(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const pos = strm.tell() catch return .SPIPE;
        defer strm.seek(@intCast(pos), 0) catch {};
        strm.seek(@intCast(args.offset), 0) catch return .SPIPE;
        const slice = args.bytes[0..args.len];
        const written = strm.write(slice) catch return .INVAL;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handlePositionalVectorWrite(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const pos = strm.tell() catch return .SPIPE;
        defer strm.seek(@intCast(pos), 0) catch {};
        strm.seek(@intCast(args.offset), 0) catch return .SPIPE;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            const slice = iov.base[0..iov.len];
            total += strm.write(slice) catch return .INVAL;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handleSeek(self: *@This(), args: anytype) !E {
        const entry = self.findStreamEntry(args.fd) catch return .BADF;
        const strm = entry.stream;
        if (entry.dir_iter) |iter| {
            if (args.offset != 0) {
                if (args.whence != c.SEEK_SET) return .INVAL;
                iter.seek(@intCast(args.offset));
                return .SUCCESS;
            } else {
                // clear cached entries when it's a rewind
                iter.reset();
            }
        }
        strm.seek(args.offset, args.whence) catch return .SPIPE;
        args.position = strm.tell() catch return .SPIPE;
        return .SUCCESS;
    }

    fn handleTell(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        args.position = strm.tell() catch return .SPIPE;
        return .SUCCESS;
    }

    fn handleSettimes(self: *@This(), args: anytype) !E {
        const loc: PathInfo = get: {
            if (@hasField(@TypeOf(args.*), "fd")) {
                const entry = self.findStreamEntry(args.fd) catch return .BADF;
                break :get .{
                    .url = entry.path.retain(),
                    .context = entry.stream.getContext(),
                };
            } else {
                break :get (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
            }
        };
        defer loc.deinit();
        const buf: c.utimbuf = .{
            .actime = @divTrunc(args.atime, 1_000_000_000),
            .modtime = @divTrunc(args.mtime, 1_000_000_000),
        };
        Stream.touch(loc.url, &buf, loc.context) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleStat(self: *@This(), args: anytype) !E {
        if (@hasField(@TypeOf(args.*), "fd")) {
            const strm = self.findStream(args.fd) catch return .BADF;
            strm.stat(&args.stat) catch return .INVAL;
        } else {
            if (self.findStreamEntryWithFdPath(args.path)) |entry| {
                const strm = entry.stream;
                strm.stat(&args.stat) catch return .INVAL;
            } else {
                const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
                defer loc.deinit();
                Stream.statPath(loc.url, loc.context, args.lookup_flags, &args.stat) catch return .NOENT;
            }
        }
        return .SUCCESS;
    }

    fn handleTruncate(self: *@This(), args: anytype) !E {
        if (@hasField(@TypeOf(args.*), "fd")) {
            const strm = self.findStream(args.fd) catch return .BADF;
            const len = switch (args.len) {
                std.math.maxInt(u64) => try strm.tell(),
                else => args.len,
            };
            strm.truncate(len) catch return .FBIG;
        } else {
            if (self.findStreamEntryWithFdPath(args.path)) |entry| {
                const strm = entry.stream;
                strm.truncate(args.len) catch return .FBIG;
            } else {
                const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
                defer loc.deinit();
                const strm = Stream.open(loc.url, "x", loc.context, 0) catch return .NOENT;
                defer strm.close(true);
                strm.truncate(args.len) catch return .FBIG;
            }
        }
        return .SUCCESS;
    }

    fn handleGetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStreamEntry(args.fd) catch return .BADF;
        args.fdstat = entry.fd_stat;
        return .SUCCESS;
    }

    fn handleSetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStreamEntry(args.fd) catch return .BADF;
        const strm = entry.stream;
        strm.setBlocking(!args.fdflags.NONBLOCK) catch return .INVAL;
        entry.fd_stat.fs_flags.NONBLOCK = args.fdflags.NONBLOCK;
        return .SUCCESS;
    }

    fn handleSetLock(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        // TODO: use packed struct
        const lock_type: c_int = switch (args.lock.type) {
            Syscall.Lock.RDLCK => std.posix.LOCK.SH,
            Syscall.Lock.WRLCK => std.posix.LOCK.EX,
            Syscall.Lock.UNLCK => std.posix.LOCK.UN,
            else => return .INVAL,
        };
        strm.setLock(lock_type) catch {
            return switch (lock_type) {
                std.posix.LOCK.UN => .NOLCK,
                else => .AGAIN,
            };
        };
        return .SUCCESS;
    }

    fn handleGetLock(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        const lock_type: c_int = switch (args.lock.type) {
            Syscall.Lock.RDLCK => std.posix.LOCK.SH,
            Syscall.Lock.WRLCK => std.posix.LOCK.EX,
            else => return .INVAL,
        };
        // try setting the lock
        if (strm.setLock(lock_type)) {
            // unlock it again
            strm.setLock(std.posix.LOCK.UN) catch {};
            args.lock.type = Syscall.Lock.UNLCK;
        } else |_| {
            if (lock_type == std.posix.LOCK.SH) {
                // can't get a shared lock because there's an exclusive lock
                args.lock.type = Syscall.Lock.WRLCK;
            } else {
                // see if a shared lock would succeed
                if (strm.setLock(lock_type)) {
                    strm.setLock(std.posix.LOCK.SH) catch {};
                    args.lock.type = Syscall.Lock.RDLCK;
                } else |_| {
                    args.lock.type = Syscall.Lock.WRLCK;
                }
            }
        }
        return .SUCCESS;
    }

    fn handleAdvise(self: *@This(), args: anytype) !E {
        _ = self.findStreamEntry(args.fd) catch return .BADF;
        return .SUCCESS;
    }

    fn handleAllocate(self: *@This(), args: anytype) !E {
        _ = self.findStreamEntry(args.fd) catch return .BADF;
        return .NOSYS;
    }

    fn handleSync(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        strm.flush() catch return .IO;
        return .SUCCESS;
    }

    fn handleDatasync(self: *@This(), args: anytype) !E {
        const strm = self.findStream(args.fd) catch return .BADF;
        strm.flush() catch return .IO;
        return .SUCCESS;
    }

    fn handleMkdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        Stream.makeDirectory(loc.url, args.mode, loc.context) catch {
            var info: std.os.wasi.filestat_t = undefined;
            return if (Stream.statPath(loc.url, null, .{}, &info)) .EXIST else |_| .NOENT;
        };
        return .SUCCESS;
    }

    fn handleRmdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        Stream.removeDirectory(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleUnlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        Stream.unlink(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleReadlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        return .ACCES;
    }

    fn handleSymlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        return .ACCES;
    }

    fn handleRename(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const new_loc = (self.resolvePath(args.new_dirfd, args.new_path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer new_loc.deinit();
        Stream.rename(loc.url, new_loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleGetdents(self: *@This(), args: anytype) !E {
        const entry = self.findStreamEntry(args.dirfd) catch return .BADF;
        var index: usize = 0;
        var remaining: usize = args.len;
        const iter = entry.dir_iter orelse return .NOTDIR;
        while (try iter.next(entry.stream)) |dir_entry| {
            const name_ptr: [*:0]const u8 = @ptrCast(&dir_entry.d_name);
            const name = name_ptr[0..std.mem.len(name_ptr)];
            if (name.len + @sizeOf(std.os.wasi.dirent_t) > remaining) {
                iter.seek(iter.index);
                break;
            }
            var info: std.os.wasi.filestat_t = undefined;
            if (iter.index < 2) {
                info.ino = 0;
                info.filetype = .DIRECTORY;
            } else {
                const path = joinPath(entry.path.slice(), name);
                defer path.release();
                Stream.statPath(path, null, .{}, &info) catch {
                    info.ino = 0;
                    info.filetype = .UNKNOWN;
                };
            }
            const out_dirent: *align(1) std.os.wasi.dirent_t = @ptrCast(&args.buffer[index]);
            out_dirent.next = iter.index + 1;
            out_dirent.ino = info.ino;
            out_dirent.namlen = @intCast(name.len);
            out_dirent.type = info.filetype;
            const si = index + @sizeOf(std.os.wasi.dirent_t);
            const ei = si + name.len;
            const out_name = args.buffer[si..ei];
            @memcpy(out_name, name);
            index += name.len + @sizeOf(std.os.wasi.dirent_t);
            remaining -= name.len + @sizeOf(std.os.wasi.dirent_t);
        }
        args.read = @intCast(index);
        return .SUCCESS;
    }

    fn handlePoll(_: *@This(), _: anytype) !E {
        return .INVAL;
    }

    fn handleCopyFileRange(self: *@This(), args: anytype) !E {
        const out_strm, const close_out_strm = self.useStream(args.out_fd, "w") catch return .BADF;
        defer if (close_out_strm) out_strm.close(true);
        const in_strm, const close_in_strm = self.useStream(args.in_fd, "r") catch return .BADF;
        defer if (close_in_strm) in_strm.close(true);
        args.copied = out_strm.copyRange(args.out_offset, in_strm, args.in_offset, args.len) catch |err| {
            return switch (err) {
                error.InvalidOffset => .INVAL,
                else => .IO,
            };
        };
        return .SUCCESS;
    }

    fn handleGetEnvironmentStrings(self: *@This(), args: anytype) !E {
        if (self.env_variable_list != null) {
            args.list = @ptrCast(self.env_variable_list.?.ptr);
            args.bytes = @ptrCast(self.env_variable_bytes.?.ptr);
            args.count = @intCast(self.env_variable_list.?.len);
            args.len = @intCast(self.env_variable_bytes.?.len);
            return .SUCCESS;
        } else {
            return .OPNOTSUPP;
        }
    }

    fn onRequestShutdown(ptr: *anyopaque) void {
        const self: *@This() = @ptrCast(@alignCast(ptr));
        self.releaseResources();
    }

    fn releaseResources(self: *@This()) void {
        if (!self.release_resources_called) {
            self.release_resources_called = true;
            if (self.redirection_cb) |*cb| {
                cb.release();
                self.redirection_cache.deinit();
                self.redirection_cb = null;
            }
            self.removeAllStreams();
            self.removeAllCallbacks();
        }
    }
};
