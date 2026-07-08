const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const c = @import("c");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const DynLib = @import("dyn-lib.zig").DynLib;
const EventLoop = @import("event-loop.zig").EventLoop;
const extension = @import("extension.zig");
const failure = @import("failure.zig");
const interface = @import("module/native/interface.zig");
const Jscall = interface.Jscall;
const Syscall = interface.Syscall;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const FunctionCallCache = php.FunctionCallCache;
const HashTable = php.HashTable;
const Long = php.Long;
const Object = php.Object;
const Stream = php.Stream;
const StreamContext = php.StreamContext;
const String = php.String;
const Value = php.Value;
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
    redirection_cache: FunctionCallCache = undefined,
    redirecting_root: bool = false,
    redirecting_other_libraries: bool = false,
    function_list: std.ArrayList(CallbackEntry) = .empty,
    next_function_id: usize = 5, // 1-4 are reserve for the methods of the host allocator
    stream_list: std.ArrayList(StreamEntry) = .empty,
    host: *ModuleHost,
    hooks_installed: bool = false,
    syscall_trap_installed: bool = false,
    syscall_trap_count: usize = 0,
    thread_syscall_trap_list: std.ArrayList(*bool) = .empty,
    thread_syscall_trap_list_mutex: std.Thread.Mutex = .{},
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

    var pipe_list_mutex: std.Thread.Mutex = .{};
    var pipe_list: std.ArrayList(c_int) = .empty;

    pub const HookEntry = interface.HookEntry;
    pub const HandlerVTable = interface.HandlerVTable;

    const redirection_controller = redirection.Controller(@This());
    const CallbackEntry = struct {
        id: usize,
        class: *ZigClassEntry,
        callable: Value,
        cache: FunctionCallCache,
        buffer: *ByteBuffer,

        pub fn deinit(self: *@This()) void {
            php.release(self.class.object);
            php.release(&self.callable);
            // ByteBuffer.free() flags the contents of the buffer as invalid without
            // releasing the buffer;
            self.buffer.free();
            self.buffer.release();
            self.cache.deinit();
        }
    };
    const StreamEntry = struct {
        fd: Long,
        stream: *Stream,
        path: *String,
        fd_stat: std.os.wasi.fdstat_t,
        dir_entry: ?*php.DirEntry = null,
        flags: packed struct {
            populated: bool = false,
        } = .{},

        pub fn deinit(self: *const @This()) void {
            php.release(self.path);
            if (self.dir_entry) |de| php.allocator.destroy(de);
            const res = php.getStreamResource(self.stream);
            php.release(res);
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
                std.Thread.Futex.timedWait(&self.value, initial_value, self.timeout) catch {
                    return E.SUCCESS;
                };
            } else {
                std.Thread.Futex.wait(&self.value, initial_value);
            }
            const final_value = self.value.load(.acquire);
            return std.meta.intToEnum(E, final_value) catch E.FAULT;
        }

        pub fn wake(handle: usize, result: E) void {
            if (handle > 0) {
                const ptr: *Futex = @ptrFromInt(handle);
                if (ptr.handle == handle) {
                    ptr.value.store(@intFromEnum(result), .release);
                    std.Thread.Futex.wake(&ptr.value, 1);
                }
            }
        }
    };
    const fd_min = 0x00f0_0000;
    const fd_max = 0x00ff_ffff;

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{ .host = host, .pipe_ptr = &pipes };
        try extension.addRequestShutdownCallback(self, onRequestShutdown);
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
        extension.removeRequestShutdownCallback(self, onRequestShutdown);
        self.releaseResources();
        php.allocator.destroy(self);
    }

    pub fn installHandler() !void {
        if (!thread_initialized) {
            in_main_thread = true;
            redirection_controller.installSignalHandler() catch {};
            if (php.pipe(&pipes) < 0) return error.UnableToOpenPipe;
            pipe_list_mutex.lock();
            defer pipe_list_mutex.unlock();
            for (pipes) |fd| try pipe_list.append(std.heap.c_allocator, fd);
        }
    }

    pub fn uninstallHandlers() void {
        trapping_syscalls = false;
        for (pipes) |fd| _ = c.close(fd);
        redirection_controller.uninstallSignalHandler();
    }

    pub fn createJsThunk(self: *@This(), class: *ZigClassEntry, callable: *Value, buffer: *ByteBuffer) !void {
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

    fn saveCallback(self: *@This(), class: *ZigClassEntry, callable: *Value, buffer: *ByteBuffer) !usize {
        const cache = try FunctionCallCache.init(callable);
        const fn_id = self.next_function_id;
        self.next_function_id += 1;
        try self.function_list.append(php.allocator, .{
            .id = fn_id,
            .class = class,
            .callable = callable.*,
            .cache = cache,
            .buffer = buffer,
        });
        php.addRef(callable);
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
        list.deinit(php.allocator);
    }

    fn scheduleTask(self: *@This(), operation: ScheduledTask.Operation) !void {
        const fd = self.pipe_ptr[1];
        const task: ScheduledTask = .{ .self = self, .operation = operation };
        const written = c.write(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
        // std.debug.print("CallDispatcher.scheduleTask() called\n", .{});
        if (written < 0) return error.Unexpected;
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
            try self.scheduleTask(.{ .jscall = call });
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
            self.scheduleTask(.{ .syscall = call }) catch return .FAULT;
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
            const strm_obj = try php.openDescriptor(pipes[0], "r");
            php.preserveStream(strm_obj);
            errdefer php.close(strm_obj);
            try php.setBlocking(strm_obj, false);
            const strm = php.createValueStream(strm_obj);
            try event_loop.init(&strm);
            defer php.release(&strm);
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
        const read = c.read(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
        if (read != @sizeOf(ScheduledTask)) return;
        const self = task.self;
        // std.debug.print("runScheduledTask\n", .{});
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
            self.thread_syscall_trap_list_mutex.lock();
            defer self.thread_syscall_trap_list_mutex.unlock();
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
            self.thread_syscall_trap_list_mutex.lock();
            defer self.thread_syscall_trap_list_mutex.unlock();
            const index = for (self.thread_syscall_trap_list.items, 0..) |ptr, i| {
                if (ptr == &trapping_syscalls) break i;
            } else return;
            _ = self.thread_syscall_trap_list.swapRemove(index);
        }
    }

    pub fn isVirtualStream(_: *@This(), fd: Long) bool {
        return fd >= fd_min and fd <= fd_max;
    }

    pub fn addStream(self: *@This(), strm: *Stream, is_dir: bool) !Long {
        const fd = try self.createDescriptor();
        const path = try getStreamPath(strm);
        defer php.release(path);
        const fdstat = getStreamStat(strm, is_dir);
        _ = try self.addStreamEntry(fd, path, strm, &fdstat);
        return fd;
    }

    pub fn removeStream(self: *@This(), fd: Long) !void {
        if (fd == -1) self.redirecting_root = false;
        for (self.stream_list.items, 0..) |*item, i| {
            if (item.fd == fd) {
                item.deinit();
                _ = self.stream_list.swapRemove(i);
                break;
            }
        } else return error.Unexpected;
    }

    fn removeAllStreams(self: *@This()) void {
        var list = self.stream_list;
        while (list.pop()) |*item| item.deinit();
        list.deinit(php.allocator);
    }

    pub fn getStreamPath(strm: *Stream) !*String {
        if (php.getStreamPath(strm)) |path_sc| {
            return php.createString(path_sc);
        } else if (php.getStreamWrapperProperty(strm, "path") catch null) |path_v| {
            if (php.getValueString(path_v) catch null) |path| return php.reuse(path);
        }
        return failure.report("stream wrapper does not have the property 'path'", .{});
    }

    pub fn getStreamStat(strm: *Stream, is_dir: bool) std.os.wasi.fdstat_t {
        const filetype: std.os.wasi.filetype_t = get: {
            var stat: std.os.wasi.filestat_t = undefined;
            break :get if (php.fstat(strm, &stat))
                stat.filetype
            else |_| if (is_dir) .DIRECTORY else .CHARACTER_DEVICE;
        };
        var fdstat: std.os.wasi.fdstat_t = .{
            .fs_filetype = filetype,
            .fs_flags = .{},
            .fs_rights_base = .{},
            .fs_rights_inheriting = .{},
        };
        const mode = php.getStreamMode(strm);
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

    pub fn redirectStream(self: *@This(), fd: Long, arg: *Value) !void {
        if (fd == -1) {
            if (self.redirection_cb) |*cb| {
                php.release(cb);
                self.redirection_cb = null;
                self.redirecting_root = false;
            }
            if (FunctionCallCache.init(arg) catch null) |cache| {
                self.redirection_cb = php.reuse(arg).*;
                self.redirection_cache = cache;
                self.redirecting_root = true;
                self.removeStream(fd) catch {};
                return;
            }
        }
        const strm = try php.getValueStream(arg);
        const path = try getStreamPath(strm);
        defer php.release(path);
        const fdstat = getStreamStat(strm, fd == -1);
        self.removeStream(fd) catch {};
        _ = try self.addStreamEntry(fd, path, strm, &fdstat);
        if (fd == -1) self.redirecting_root = true;
    }

    fn findStream(self: *@This(), fd: Long) !*StreamEntry {
        for (self.stream_list.items) |*item| {
            if (item.fd == fd) return item;
        } else {
            const path_sc: []const u8, const mode: [*:0]const u8 = switch (fd) {
                0 => .{ "php://input", "r" },
                1, 2 => .{ "php://output", "w" },
                else => return error.Unexpected,
            };
            const path = php.createString(path_sc);
            defer php.release(path);
            const strm = php.open(path, mode, null, 0) catch return error.Unexpected;
            errdefer php.close(strm);
            const fdstat: std.os.wasi.fdstat_t = .{
                .fs_filetype = .CHARACTER_DEVICE,
                .fs_flags = .{},
                .fs_rights_base = .{
                    .FD_READ = mode[0] == 'r',
                    .FD_WRITE = mode[0] == 'w',
                },
                .fs_rights_inheriting = .{},
            };
            return try self.addStreamEntry(fd, path, strm, &fdstat);
        }
    }

    fn useStream(self: *@This(), fd: Long, mode: [*c]const u8) !std.meta.Tuple(&.{ *Stream, bool }) {
        switch (fd) {
            0, 1, 2, fd_min...fd_max => {
                const entry = try self.findStream(fd);
                return .{ entry.stream, false };
            },
            else => {
                const strm = try php.openDescriptor(@intCast(fd), mode);
                return .{ strm, true };
            },
        }
    }

    fn addStreamEntry(self: *@This(), fd: Long, path: *String, strm: *Stream, stat: *const std.os.wasi.fdstat_t) !*StreamEntry {
        const entry = try self.stream_list.addOne(php.allocator);
        entry.* = .{
            .fd = fd,
            .path = path,
            .stream = strm,
            .fd_stat = stat.*,
        };
        php.addRef(path);
        const res = php.getStreamResource(strm);
        php.addRef(res);
        if (stat.fs_filetype == .DIRECTORY) {
            entry.dir_entry = php.allocator.create(php.DirEntry) catch null;
        }
        return entry;
    }

    fn createDescriptor(self: *@This()) !Long {
        var fd: Long = fd_min;
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
                if (path[i + 1] == '/') {
                    if (path[i + 2] == '/') {
                        return php.createString(path[start..]);
                    } else {
                        // assume the '//' in 'protocol://host' got replaced by a single slash
                        const len = path.len - start + 1;
                        const str = php.createStringWithLength(len);
                        const sc = @constCast(php.getStringContent(str));
                        const j = i - start;
                        @memcpy(sc[0..j], path[start..i]);
                        @memcpy(sc[j .. j + 3], "://");
                        @memcpy(sc[j + 3 ..], path[i + 2 ..]);
                        sc.ptr[len] = 0;
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
        context: ?*StreamContext = null,

        pub fn deinit(self: *const @This()) void {
            php.release(self.url);
            if (self.context) |cxt| php.release(cxt.res);
        }
    };

    fn resolvePath(self: *@This(), dirfd: i32, path_c: [*:0]const u8) !?PathInfo {
        const path = path_c[0..std.mem.len(path_c)];
        var context: ?*StreamContext = null;
        const url: *String = getWrapperUrl(path) orelse find: {
            if (dirfd == -1) {
                // if a callback was given, call it to see if this path should be redirected somewhere else
                if (self.redirection_cb != null) {
                    const args: [1]Value = .{php.createValueStringContent(path)};
                    defer php.release(&args[0]);
                    const retval = try self.redirection_cache.invoke(&args);
                    defer php.release(&retval);
                    switch (php.getValueType(&retval)) {
                        .null, .false => return null,
                        .string => {
                            const parent_path = php.getValueStringContent(&retval) catch unreachable;
                            break :find joinPath(parent_path, path);
                        },
                        .resource => {
                            const strm = try php.getValueStream(&retval);
                            const strm_path = try getStreamPath(strm);
                            defer php.release(strm_path);
                            const parent_path = php.getStringContent(strm_path);
                            context = php.getStreamContext(strm);
                            break :find joinPath(parent_path, path);
                        },
                        else => return error.InvalidReturnValueFromCallback,
                    }
                }
                // don't bother lookup the root stream if the root descriptor hasn't been redirected
                if (!self.redirecting_root) return null;
            }
            const parent = try self.findStream(dirfd);
            const parent_path = php.getStringContent(parent.path);
            context = php.getStreamContext(parent.stream);
            break :find joinPath(parent_path, path);
        };
        if (context) |cxt| php.addRef(cxt.res);
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
        const str = php.createStringWithLength(len);
        const sc: [*]u8 = @ptrCast(&str.val[0]);
        @memcpy(sc[0..parent_path.len], parent_path);
        if (slash_count == 1) sc[parent_path.len] = '/';
        @memcpy(sc[parent_path.len + slash_count .. len], path);
        sc[len] = 0;
        return str;
    }

    fn handleOpen(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const strm, const file_type: std.os.wasi.filetype_t = open: {
            if (args.rights.FD_READDIR) {
                // opening a directory
                if (php.opendir(loc.url, 0, null) catch null) |strm| {
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
            const strm = php.open(loc.url, mode, loc.context, 0) catch return .NOENT;
            break :open .{ strm, .REGULAR_FILE };
        };
        errdefer php.close(strm);
        const stat: std.os.wasi.fdstat_t = .{
            .fs_filetype = file_type,
            .fs_flags = args.descriptor_flags,
            .fs_rights_base = args.rights,
            .fs_rights_inheriting = .{},
        };
        const fd = self.createDescriptor() catch return .MFILE;
        _ = self.addStreamEntry(fd, loc.url, strm, &stat) catch return .MFILE;
        args.fd = @intCast(fd);
        return .SUCCESS;
    }

    fn handleClose(self: *@This(), args: anytype) !E {
        self.removeStream(args.fd) catch return .BADF;
        return .SUCCESS;
    }

    fn handleRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const read = php.read(entry.stream, args.bytes, args.len) catch return .INVAL;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handleVectorRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.read(entry.stream, iov.base, iov.len) catch return .INVAL;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .INVAL;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const read = php.read(entry.stream, args.bytes, args.len) catch return .IO;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handlePositionalVectorRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .INVAL;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.read(entry.stream, iov.base, iov.len) catch return .INVAL;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handleWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const written = php.write(entry.stream, args.bytes, args.len) catch return .INVAL;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handleWriteStderr(self: *@This(), args: anytype) !E {
        const entry = self.findStream(2) catch return .BADF;
        _ = php.write(entry.stream, args.bytes, args.len) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleVectorWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.write(entry.stream, iov.base, iov.len) catch return .INVAL;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .INVAL;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const written = php.write(entry.stream, args.bytes, args.len) catch return .INVAL;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handlePositionalVectorWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .SPIPE;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.write(entry.stream, iov.base, iov.len) catch return .INVAL;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handleSeek(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.seek(entry.stream, args.offset, args.whence) catch return .INVAL;
        args.position = php.tell(entry.stream) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleTell(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        args.position = php.tell(entry.stream) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleSettimes(self: *@This(), args: anytype) !E {
        const loc: PathInfo = get: {
            if (@hasField(@TypeOf(args.*), "fd")) {
                const entry = self.findStream(args.fd) catch return .BADF;
                php.addRef(entry.path);
                break :get .{
                    .url = entry.path,
                    .context = php.getStreamContext(entry.stream),
                };
            } else {
                break :get (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
            }
        };
        defer loc.deinit();
        const buf: php.utimbuf = .{
            .actime = @divTrunc(args.atime, 1_000_000_000),
            .modtime = @divTrunc(args.mtime, 1_000_000_000),
        };
        php.touch(loc.url, &buf, loc.context) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleStat(self: *@This(), args: anytype) !E {
        if (@hasField(@TypeOf(args.*), "fd")) {
            const entry = self.findStream(args.fd) catch return .BADF;
            php.fstat(entry.stream, &args.stat) catch return .INVAL;
        } else {
            const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
            defer loc.deinit();
            php.stat(loc.url, loc.context, args.lookup_flags, &args.stat) catch return .NOENT;
        }
        return .SUCCESS;
    }

    fn handleTruncate(self: *@This(), args: anytype) !E {
        if (@hasField(@TypeOf(args.*), "fd")) {
            const entry = self.findStream(args.fd) catch return .BADF;
            php.truncate(entry.stream, args.len) catch return .FBIG;
        } else {
            const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
            defer loc.deinit();
            const strm = php.open(loc.url, "x", loc.context, 0) catch return .NOENT;
            defer php.close(strm);
            php.truncate(strm, args.len) catch return .FBIG;
        }
        return .SUCCESS;
    }

    fn handleGetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        args.fdstat = entry.fd_stat;
        return .SUCCESS;
    }

    fn handleSetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.setBlocking(entry.stream, !args.fdflags.NONBLOCK) catch return .INVAL;
        entry.fd_stat.fs_flags.NONBLOCK = args.fdflags.NONBLOCK;
        return .SUCCESS;
    }

    fn handleSetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const lock_type: c_int = switch (args.lock.type) {
            Syscall.Lock.RDLCK => std.posix.LOCK.SH,
            Syscall.Lock.WRLCK => std.posix.LOCK.EX,
            Syscall.Lock.UNLCK => std.posix.LOCK.UN,
            else => return .INVAL,
        };
        php.setLock(entry.stream, lock_type) catch {
            return switch (lock_type) {
                std.posix.LOCK.UN => .NOLCK,
                else => .AGAIN,
            };
        };
        return .SUCCESS;
    }

    fn handleGetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const lock_type: c_int = switch (args.lock.type) {
            Syscall.Lock.RDLCK => std.posix.LOCK.SH,
            Syscall.Lock.WRLCK => std.posix.LOCK.EX,
            else => return .INVAL,
        };
        // try setting the lock
        if (php.setLock(entry.stream, lock_type)) {
            // unlock it again
            php.setLock(entry.stream, std.posix.LOCK.UN) catch {};
            args.lock.type = Syscall.Lock.UNLCK;
        } else |_| {
            if (lock_type == std.posix.LOCK.SH) {
                // can't get a shared lock because there's an exclusive lock
                args.lock.type = Syscall.Lock.WRLCK;
            } else {
                // see if a shared lock would succeed
                if (php.setLock(entry.stream, lock_type)) {
                    php.setLock(entry.stream, std.posix.LOCK.SH) catch {};
                    args.lock.type = Syscall.Lock.RDLCK;
                } else |_| {
                    args.lock.type = Syscall.Lock.WRLCK;
                }
            }
        }
        return .SUCCESS;
    }

    fn handleAdvise(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        _ = entry;
        return .SUCCESS;
    }

    fn handleAllocate(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        _ = entry;
        return .NOSYS;
    }

    fn handleSync(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.flush(entry.stream);
        return .SUCCESS;
    }

    fn handleDatasync(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.flush(entry.stream);
        return .SUCCESS;
    }

    fn handleMkdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.mkdir(loc.url, args.mode, loc.context) catch {
            var info: std.os.wasi.filestat_t = undefined;
            return if (php.stat(loc.url, null, .{}, &info)) .EXIST else |_| .NOENT;
        };
        return .SUCCESS;
    }

    fn handleRmdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.rmdir(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleUnlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .NOENT) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.unlink(loc.url, loc.context) catch return .NOENT;
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
        php.rename(loc.url, new_loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleGetdents(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.dirfd) catch return .BADF;
        const dir_entry = entry.dir_entry orelse return .NOMEM;
        var index: usize = 0;
        var remaining: usize = args.len;
        while (true) {
            if (!entry.flags.populated) {
                if (php.readdir(entry.stream, dir_entry)) {
                    entry.flags.populated = true;
                } else break;
            }
            const name_ptr: [*:0]u8 = @ptrCast(&dir_entry.d_name);
            const name = name_ptr[0..std.mem.len(name_ptr)];
            if (name.len + @sizeOf(std.os.wasi.dirent_t) > remaining) {
                break;
            }
            const dir_path = php.getStringContent(entry.path);
            const path = joinPath(dir_path, name);
            defer php.release(path);
            var info: std.os.wasi.filestat_t = undefined;
            php.stat(path, null, .{}, &info) catch {
                info.ino = 0;
                info.filetype = .UNKNOWN;
            };
            const out_dirent: *align(1) std.os.wasi.dirent_t = @ptrCast(&args.buffer[index]);
            out_dirent.next = @intFromPtr(dir_entry);
            out_dirent.ino = info.ino;
            out_dirent.namlen = @intCast(name.len);
            out_dirent.type = info.filetype;
            const si = index + @sizeOf(std.os.wasi.dirent_t);
            const ei = si + name.len;
            const out_name = args.buffer[si..ei];
            @memcpy(out_name, name);
            entry.flags.populated = false;
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
        defer if (close_out_strm) php.close(out_strm);
        const in_strm, const close_in_strm = self.useStream(args.in_fd, "r") catch return .BADF;
        defer if (close_in_strm) php.close(in_strm);
        args.copied = php.copyFileRange(in_strm, out_strm, args.in_offset, args.out_offset, args.len) catch |err| {
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
                php.release(cb);
                self.redirection_cache.deinit();
                self.redirection_cb = null;
            }
            self.removeAllStreams();
            self.removeAllCallbacks();
        }
    }
};
