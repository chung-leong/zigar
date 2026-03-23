const std = @import("std");
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const Closure = @import("closure.zig").Closure;
const EventLoop = @import("event-loop.zig").EventLoop;
const interface = @import("module/native/interface.zig");
const Jscall = interface.Jscall;
const Syscall = interface.Syscall;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ExecuteData = php.ExecuteData;
const HashTable = php.HashTable;
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
    function_list: std.ArrayList(CallbackEntry) = .empty,
    next_function_id: c_ulong = 1,
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
    multithread_enabled: bool = false,
    pipe_ptr: [*]std.posix.fd_t,

    pub threadlocal var trapping_syscalls: bool = false;
    pub threadlocal var event_loop: EventLoop(runScheduledTask) = .{};

    threadlocal var thread_initialized: bool = false;
    threadlocal var in_main_thread: bool = false;
    threadlocal var pipes: [2]std.posix.fd_t = undefined;
    threadlocal var multithread_count: usize = 0;

    var pipe_list_mutex: std.Thread.Mutex = .{};
    var pipe_list: std.ArrayList(std.posix.fd_t) = .empty;

    pub const HookEntry = interface.HookEntry;
    pub const HandlerVTable = interface.HandlerVTable;

    const redirection_controller = redirection.Controller(@This());
    const CallbackEntry = struct {
        id: usize,
        class: *ZigClassEntry,
        callable: Value,

        pub fn deinit(self: *@This()) void {
            self.class.release();
            php.release(&self.callable);
        }
    };
    const StreamEntry = struct {
        fd: c_long,
        url: *String,
        stream: *Stream,
        fd_stat: std.os.wasi.fdstat_t,

        pub fn deinit(self: *@This()) void {
            php.release(self.url);
            _ = php.close(self.stream);
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

        pub fn wake(handle: usize, result: E) !void {
            const ptr: *Futex = @ptrFromInt(handle);
            if (ptr.handle != handle) return error.Unexpected;
            ptr.value.store(@intFromEnum(result), .release);
            std.Thread.Futex.wake(&ptr.value, 1);
        }
    };
    const fd_min = 0x00f0_0000;
    const fd_max = 0x00ff_ffff;

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{ .host = host, .pipe_ptr = &pipes };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        self.disableMultithread() catch {};
        if (self.syscall_trap_installed) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                redirection_controller.removeSyscallVtable(vtable) catch {};
            }
        }
        for (self.function_list.items) |*ptr| ptr.deinit();
        self.function_list.deinit(php.allocator);
        for (self.stream_list.items) |*ptr| ptr.deinit();
        self.stream_list.deinit(php.allocator);
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
        for (pipes) |fd| _ = std.c.close(fd);
    }

    pub fn createJsThunk(self: *@This(), class: *ZigClassEntry, callable: *Value) !usize {
        const fn_static = class.getStaticData(structure.Function);
        const controller_address = fn_static.controller_address;
        if (controller_address == 0) return error.Unexpected;
        var thunk_address: usize = 0;
        const module = self.host.module orelse return error.Unexpected;
        const fn_id = try self.saveCallback(class, callable);
        _ = module.exports.create_js_thunk(controller_address, fn_id, &thunk_address);
        return thunk_address;
    }

    pub fn destroyJsThunk(self: *@This(), controller_address: usize, thunk_address: usize) !void {
        var fn_id: usize = 0;
        const module = self.host.module orelse return error.Unexpected;
        _ = module.exports.destroy_js_thunk(controller_address, thunk_address, &fn_id);
        try self.deleteCallback(fn_id);
    }

    fn saveCallback(self: *@This(), class: *ZigClassEntry, callable: *Value) !usize {
        const fn_id = self.next_function_id;
        self.next_function_id +%= 1;
        try self.function_list.append(php.allocator, .{
            .id = fn_id,
            .class = class,
            .callable = callable.*,
        });
        php.addRef(callable);
        class.addRef();
        return fn_id;
    }

    fn findCallback(self: *@This(), fn_id: usize) ?*CallbackEntry {
        return for (self.function_list.items) |*item| {
            if (item.id == fn_id) break item;
        } else null;
    }

    fn deleteCallback(self: *@This(), fn_id: usize) void {
        for (self.function_list.items, 0..) |*ptr, i| {
            if (ptr.id == fn_id) {
                ptr.deinit();
                _ = self.function_list.swapRemove(i);
                break;
            }
        }
    }

    fn scheduleTask(self: *@This(), operation: ScheduledTask.Operation) !void {
        const fd = self.pipe_ptr[1];
        const task: ScheduledTask = .{ .self = self, .operation = operation };
        const written = std.c.write(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
        std.debug.print("CallDispatcher.scheduleTask() called\n", .{});
        if (written < 0) return error.Unexpected;
    }

    pub fn handleJscall(self: *@This(), call: *Jscall) !E {
        if (in_main_thread) {
            std.debug.print("handleJscall, fd_id = {d}\n", .{call.fn_id});
            const cb = self.findCallback(call.fn_id) orelse return .FAULT;
            const arg_ptr: [*]u8 = @ptrFromInt(call.arg_address);
            const arg_bytes = arg_ptr[0..call.arg_size];
            // create a copy of the arg struct, which sits on the stack, when the call
            // comes from a different thread
            const arg_buffer = switch (call.futex_handle) {
                0 => try ByteBuffer.createExternal(arg_bytes, cb.class.alignment),
                else => try ByteBuffer.createCopy(arg_bytes, cb.class.alignment),
            };
            defer arg_buffer.release();
            // use the function structure's static method to run the callback
            const fn_static = cb.class.getStaticData(structure.Function);
            try fn_static.runCallback(&cb.callable, arg_buffer);
            return .SUCCESS;
        } else {
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try self.scheduleTask(.{ .jscall = call });
            return futex.wait();
        }
    }

    pub fn handleSyscall(self: *@This(), call: *Syscall) !E {
        if (in_main_thread) {
            return switch (call.cmd) {
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
                .sendfile => try self.handleSendFile(&call.u.sendfile),
                .environ => try self.handleGetEnvironmentStrings(&call.u.environ),
                .write_stderr => try self.handleWriteStderr(&call.u.write_stderr),
            };
        } else {
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try self.scheduleTask(.{ .syscall = call });
            return futex.wait();
        }
    }

    pub fn installHooks(self: *@This(), lib: *std.DynLib, lib_path: []const u8, redirect_syscalls: bool) !void {
        const pos = try redirection_controller.installHooks(self, lib, lib_path);
        if (redirect_syscalls) {
            if (self.getSyscallHook("__sc_vtable")) |hook| {
                const vtable: *const HandlerVTable = @ptrCast(@alignCast(hook.handler));
                try redirection_controller.addSyscallVtable(pos, vtable);
                errdefer redirection_controller.removeSyscallVtable(vtable) catch {};
                if (redirection_controller.installSyscallTrap(&trapping_syscalls)) {
                    self.syscall_trap_installed = true;
                } else |_| {}
            }
            self.hooks_installed = true;
        }
    }

    pub fn getSyscallHook(self: *@This(), name: [*:0]const u8) ?HookEntry {
        const module = self.host.module.?;
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
        self.deleteCallback(fn_id);
    }

    pub fn redirectSyscalls(self: *@This(), ptr: *const anyopaque) !void {
        _ = self;
        _ = ptr;
    }

    pub fn enableMultithread(self: *@This()) !void {
        if (in_main_thread) {
            if (self.multithread_enabled) return;
            self.multithread_enabled = true;
            multithread_count += 1;
            if (multithread_count > 1) return;
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
            if (!self.multithread_enabled) return;
            self.multithread_enabled = false;
            multithread_count -= 1;
            if (multithread_count > 0) return;
            event_loop.deinit();
        } else {
            try self.scheduleTask(.{ .disable = {} });
        }
    }

    fn runScheduledTask() void {
        const fd = pipes[0];
        var task: ScheduledTask = undefined;
        while (true) {
            const read = std.c.read(fd, @ptrCast(&task), @sizeOf(ScheduledTask));
            if (read != @sizeOf(ScheduledTask)) break;
            const self = task.self;
            std.debug.print("runScheduledTask\n", .{});
            switch (task.operation) {
                .jscall => |call| {
                    const err = self.handleJscall(call) catch |err| blk: {
                        std.debug.print("err = {}\n", .{err});
                        break :blk .FAULT;
                    };
                    Futex.wake(call.futex_handle, err) catch {};
                },
                .syscall => |call| {
                    const err = self.handleSyscall(call) catch .FAULT;
                    Futex.wake(call.futex_handle, err) catch {};
                },
                .disable => {
                    self.disableMultithread() catch {};
                },
            }
            event_loop.resumePendingFiber();
        }
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
        if (self.host.module) |m| {
            _ = m.exports.set_host_instance(@ptrCast(self.host));
        }
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

    fn findStream(self: *@This(), fd: c_long) !*StreamEntry {
        for (self.stream_list.items) |*entry| {
            if (entry.fd == fd) return entry;
        } else {
            const path: []const u8, const mode: [*:0]const u8 = switch (fd) {
                0 => .{ "php://input", "r" },
                1, 2 => .{ "php://output", "w" },
                else => return error.Unexpected,
            };
            const url = php.createString(path);
            defer php.release(url);
            const strm = php.open(url, mode, 0) catch return error.Unexpected;
            const stat: std.os.wasi.fdstat_t = .{
                .fs_filetype = .REGULAR_FILE,
                .fs_flags = .{},
                .fs_rights_base = .{
                    .FD_READ = mode[0] == 'r',
                    .FD_WRITE = mode[0] == 'w',
                },
                .fs_rights_inheriting = .{},
            };
            return try self.addStreamEntry(fd, url, strm, &stat);
        }
    }

    fn addStreamEntry(self: *@This(), fd: c_long, url: *String, strm: *Stream, stat: *const std.os.wasi.fdstat_t) !*StreamEntry {
        const entry = try self.stream_list.addOne(php.allocator);
        entry.fd = fd;
        entry.url = url;
        entry.stream = strm;
        entry.fd_stat = stat.*;
        php.addRef(url);
        return entry;
    }

    fn createDescriptor(self: *@This()) !c_long {
        var fd: c_long = fd_min;
        return while (fd < fd_max) : (fd += 1) {
            for (self.stream_list.items) |item| {
                if (item.fd == fd) break;
            } else return fd;
        } else error.OutOfDescriptor;
    }

    fn getWrapperUrl(path: [*:0]const u8) ?[]const u8 {
        var start: usize = 0;
        var index: usize = 0;
        while (true) : (index += 1) {
            const c = path[index];
            if (c == ':') {
                const s = path[start..];
                const len = std.mem.len(s);
                return s[0..len];
            } else if (index == 0 and (c == '/' or c == '\\')) {
                start += 1;
            } else if (!std.ascii.isAlphanumeric(c)) {
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
        }
    };

    fn resolvePath(self: *@This(), dirfd: c_long, path: [*:0]const u8) !?PathInfo {
        if (getWrapperUrl(path)) |url| {
            return .{ .url = php.createString(url) };
        } else if (dirfd == -1) {
            return null;
        } else {
            const parent = try self.findStream(dirfd);
            const name = path[0..std.mem.len(path)];
            return .{
                .url = try php.resolve(name, parent.url),
                .context = php.getStreamContext(parent.stream),
            };
        }
    }

    fn handleOpen(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
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
        const fd = self.createDescriptor() catch return .MFILE;
        const strm = php.open(loc.url, mode, 0) catch return .NOENT;
        const stat: std.os.wasi.fdstat_t = .{
            .fs_filetype = .REGULAR_FILE,
            .fs_flags = args.descriptor_flags,
            .fs_rights_base = args.rights,
            .fs_rights_inheriting = .{},
        };
        errdefer php.close(strm);
        _ = self.addStreamEntry(fd, loc.url, strm, &stat) catch return .MFILE;
        args.fd = @intCast(fd);
        return .SUCCESS;
    }

    fn handleClose(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        entry.deinit();
        const index = (@intFromPtr(entry) - @intFromPtr(self.stream_list.items.ptr)) / @sizeOf(StreamEntry);
        _ = self.stream_list.swapRemove(index);
        return .SUCCESS;
    }

    fn handleRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const read = php.read(entry.stream, args.bytes, args.len) catch return .BADF;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handleVectorRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.read(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const read = php.read(entry.stream, args.bytes, args.len) catch return .IO;
        args.read = @intCast(read);
        return .SUCCESS;
    }

    fn handlePositionalVectorRead(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.read(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.read = @intCast(total);
        return .SUCCESS;
    }

    fn handleWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const written = php.write(entry.stream, args.bytes, args.len) catch return .BADF;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handleWriteStderr(self: *@This(), args: anytype) !E {
        const entry = self.findStream(2) catch return .BADF;
        _ = php.write(entry.stream, args.bytes, args.len) catch return .BADF;
        return .SUCCESS;
    }

    fn handleVectorWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.write(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handlePositionalWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const written = php.write(entry.stream, args.bytes, args.len) catch return .BADF;
        args.written = @intCast(written);
        return .SUCCESS;
    }

    fn handlePositionalVectorWrite(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        const pos = php.tell(entry.stream) catch return .BADF;
        defer php.seek(entry.stream, @intCast(pos), 0) catch {};
        php.seek(entry.stream, @intCast(args.offset), 0) catch return .INVAL;
        const len: usize = args.count;
        const iovs = args.iovs[0..len];
        var total: usize = 0;
        for (iovs) |iov| {
            total += php.write(entry.stream, iov.base, iov.len) catch return .BADF;
        }
        args.written = @intCast(total);
        return .SUCCESS;
    }

    fn handleSeek(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.seek(entry.stream, args.offset, args.whence) catch return .INVAL;
        args.position = php.tell(entry.stream) catch return .BADF;
        return .SUCCESS;
    }

    fn handleTell(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        args.position = php.tell(entry.stream) catch return .BADF;
        return .SUCCESS;
    }

    fn handleSettimes(self: *@This(), args: anytype) !E {
        const loc: PathInfo = get: {
            if (@hasField(@TypeOf(args.*), "fd")) {
                const entry = self.findStream(args.fd) catch return .BADF;
                php.addRef(entry.url);
                break :get .{
                    .url = entry.url,
                    .context = php.getStreamContext(entry.stream),
                };
            } else {
                break :get (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
            }
        };
        defer loc.deinit();
        const buf: php.utimbuf = .{
            .actime = @divTrunc(args.atime, 1_000_000),
            .modtime = @divTrunc(args.mtime, 1_000_000),
        };
        php.touch(loc.url, &buf, loc.context) catch return .INVAL;
        return .SUCCESS;
    }

    fn handleStat(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        return .OPNOTSUPP;
        // const env = self.env;
        // if (@hasField(@TypeOf(args.*), "fd")) {
        //     return try self.callPosixFunction(self.js.fd_filestat_get, &.{
        //         try env.createInt32(args.fd),
        //         try env.createUsize(@intFromPtr(&args.stat)),
        //         futex,
        //     });
        // } else {
        //     const path_len: u32 = @truncate(std.mem.len(args.path));
        //     return try self.callPosixFunction(self.js.path_filestat_get, &.{
        //         try env.createInt32(args.dirfd),
        //         try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
        //         try env.createUsize(@intFromPtr(args.path)),
        //         try env.createUint32(path_len),
        //         try env.createUsize(@intFromPtr(&args.stat)),
        //         futex,
        //     });
        // }
    }

    fn handleGetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        args.fdstat = entry.fd_stat;
        return .SUCCESS;
    }

    fn handleSetDescriptorFlags(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.setBlocking(entry.stream, args.fdflags.NONBLOCK) catch return .FAULT;
        php.setSync(entry.stream, args.fdflags.SYNC, args.fdflags.DSYNC) catch return .FAULT;
        return .SUCCESS;
    }

    fn handleSetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        php.setLock(entry.stream, args.lock.type) catch return .FAULT;
        return .SUCCESS;
    }

    fn handleGetLock(self: *@This(), args: anytype) !E {
        const entry = self.findStream(args.fd) catch return .BADF;
        _ = entry;
        return .OPNOTSUPP;
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
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.mkdir(loc.url, args.mode, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleRmdir(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.rmdir(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleUnlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        php.unlink(loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleReadlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        return .INVAL;
    }

    fn handleSymlink(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        return .INVAL;
    }

    fn handleRename(self: *@This(), args: anytype) !E {
        const loc = (self.resolvePath(args.dirfd, args.path) catch return .BADF) orelse return .OPNOTSUPP;
        defer loc.deinit();
        const new_loc = (self.resolvePath(args.new_dirfd, args.new_path) catch return .BADF) orelse return .OPNOTSUPP;
        defer new_loc.deinit();
        php.rename(loc.url, new_loc.url, loc.context) catch return .NOENT;
        return .SUCCESS;
    }

    fn handleGetdents(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        return .OPNOTSUPP;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_readdir, &.{
        //     try env.createInt32(args.dirfd),
        //     try env.createUsize(@intFromPtr(args.buffer)),
        //     try env.createUint32(args.len),
        //     try env.createUint32(0),
        //     try env.createUsize(@intFromPtr(&args.read)),
        //     futex,
        // });
    }

    fn handlePoll(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        return .OPNOTSUPP;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.poll_oneoff, &.{
        //     try env.createUsize(@intFromPtr(args.subscriptions)),
        //     try env.createUsize(@intFromPtr(args.events)),
        //     try env.createUint32(args.subscription_count),
        //     try env.createUsize(@intFromPtr(&args.event_count)),
        //     futex,
        // });
    }

    fn handleSendFile(self: *@This(), args: anytype) !E {
        _ = self;
        _ = args;
        return .OPNOTSUPP;
        // const env = self.env;
        // return try self.callPosixFunction(self.js.fd_sendfile, &.{
        //     try env.createInt32(args.out_fd),
        //     try env.createInt32(args.in_fd),
        //     try env.createBigintInt64(if (args.offset) |ptr| ptr.* else 0),
        //     try env.createUsize(@intFromPtr(args.offset)),
        //     try env.createUint32(args.len),
        //     try env.createUsize(@intFromPtr(&args.sent)),
        //     futex,
        // });
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
};
